import { randomUUID } from "node:crypto";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { StandardContextAnchor } from "../../../../core/agent/anchors";
import { cancellationManager, NlahHarness } from "../../../../core/agent/harness";
import type { HarnessEvent } from "../../../../core/agent/harness/types";
import { SkillRegistry } from "../../../../core/agent/skills";
import { stateStorage } from "../../../../core/agent/storage";
import { StrategyFactory, strategyRegistry } from "../../../../core/agent/strategies";
import { getImplementedFeatures, toolRegistry } from "../../../../core/agent/tools";
import { type ProviderConnectionConfig, ProviderFactory } from "../../../../infrastructure/providers/factory";
import { ERROR_STATUS } from "../../../../shared/constants/errors";
import { HTTP_STATUS } from "../../../../shared/constants/http";
import type {
  AgentState,
  MissionPayload,
  Observation,
  PausedMissionState,
  ToolDefinition,
} from "../../../../shared/types";
import { logger } from "../../../../shared/utils/logger";
import { mapHistoryToMessages } from "../../../../shared/utils/messages";
import {
  HITL_DECISIONS,
  MISSION_ERROR_MESSAGES,
  MISSION_LOG_MESSAGES,
  STREAM_CONSTANTS,
  STREAM_LOG_MESSAGES,
  VALIDATION_MESSAGES,
} from "./mission.constants";
import { createMissionSchema, hitlDecisionSchema } from "./mission.schema";
import { HttpStreamTransport } from "./stream.transport";

export async function createMission(c: Context) {
  try {
    const body = await c.req.json();
    const queryParams = c.req.query();
    const rawInput = { ...queryParams, ...body };

    const parseResult = createMissionSchema.safeParse(rawInput);
    if (!parseResult.success) {
      logger.error(VALIDATION_MESSAGES.VALIDATION_ERROR, parseResult.error.format());
      return c.json(
        {
          error: VALIDATION_MESSAGES.VALIDATION_ERROR,
          details: parseResult.error.format(),
        },
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const validatedData = parseResult.data;
    const missionId = validatedData.missionId || randomUUID();

    const payload: MissionPayload = {
      missionId,
      tenant: {
        tenantId: validatedData.tenantId,
        userId: validatedData.userId,
        orgId: validatedData.orgId,
      },
      prompt: validatedData.prompt,
      strategy: validatedData.strategy,
    };

    const historyMessages = mapHistoryToMessages(validatedData.history ?? undefined);

    const apiKeyCleaned = validatedData.provider_config.api_key?.trim();
    const llmProvider = ProviderFactory.fromConfig({
      ...validatedData.provider_config,
      api_key: apiKeyCleaned ? apiKeyCleaned : undefined,
    });
    const strategyKey = validatedData.strategy_version || validatedData.strategy;
    const executionStrategy = strategyRegistry.resolve(strategyKey);

    let state = await stateStorage.get(missionId);
    if (state) {
      state.objective = payload.prompt;
      const hasNewMessage = state.messages.some((m) => m.content === payload.prompt);
      if (!hasNewMessage) {
        state.messages.push(new HumanMessage(payload.prompt));
      }
    } else {
      state = {
        missionId,
        objective: payload.prompt,
        tasks: [],
        memory: {},
        messages: [new StandardContextAnchor().build(), ...historyMessages, new HumanMessage(payload.prompt)],
      };
    }

    const explicitFeatures = validatedData.features ?? undefined;

    if (explicitFeatures !== undefined) {
      const implementedIds = new Set(getImplementedFeatures().map((f) => f.id));
      const unknownFeature = explicitFeatures.find((id) => !implementedIds.has(id));
      if (unknownFeature) {
        logger.error(`Unknown feature requested: ${unknownFeature}`);
        return c.json({ error: MISSION_ERROR_MESSAGES.UNKNOWN_FEATURE(unknownFeature) }, HTTP_STATUS.BAD_REQUEST);
      }
    }

    let resolvedTools: ToolDefinition[] | undefined;

    if (explicitFeatures !== undefined) {
      resolvedTools = await toolRegistry.resolveTools(explicitFeatures);
    }

    if (explicitFeatures === undefined && validatedData.skills && validatedData.skills.length > 0) {
      const skillsRegistry = new SkillRegistry();
      const preferredToolNames = new Set<string>();

      for (const skillName of validatedData.skills) {
        const skill = skillsRegistry.getSkill(skillName);
        if (skill?.preferredTools) {
          for (const tool of skill.preferredTools) {
            preferredToolNames.add(tool);
          }
        }
      }

      if (preferredToolNames.size > 0) {
        resolvedTools = await toolRegistry.resolveTools([...preferredToolNames]);
      }
    }

    try {
      await llmProvider.validate?.();
    } catch (validateErr: unknown) {
      const errorMessage = validateErr instanceof Error ? validateErr.message : String(validateErr);
      logger.error(`Provider pre-validation failed: ${errorMessage}`);
      return c.json(
        {
          error: MISSION_ERROR_MESSAGES.PROVIDER_UNREACHABLE,
          details: errorMessage,
        },
        HTTP_STATUS.BAD_GATEWAY,
      );
    }

    const harness = new NlahHarness({
      missionId,
      tenantId: payload.tenant.tenantId,
      provider: llmProvider,
      strategy: executionStrategy,
      tools: resolvedTools,
      skills: validatedData.skills ?? undefined,
      harnessConfig: validatedData.config.featureToggles ?? validatedData.config.harnessConfig,
      delegationDepth: validatedData.config.harness.delegationDepth,
    });

    return streamHarnessExecution(c, {
      missionId,
      state,
      harness,
      executionLog: STREAM_LOG_MESSAGES.EXECUTION_FAILED,
      sendErrorLog: STREAM_LOG_MESSAGES.SEND_ERROR_FAILED,
    });
  } catch (error: unknown) {
    logger.error(MISSION_LOG_MESSAGES.EXECUTION_FAILURE, error);
    return c.json(
      {
        error: MISSION_LOG_MESSAGES.EXECUTION_FAILURE,
        details: error instanceof Error ? error.message : String(error),
      },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

export async function handleHitlDecision(c: Context) {
  const missionId = c.req.param("id") as string;

  const parseResult = hitlDecisionSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    logger.error("Invalid HITL decision payload", parseResult.error.format());
    return c.json(
      { error: MISSION_ERROR_MESSAGES.INVALID_DECISION, details: parseResult.error.format() },
      HTTP_STATUS.BAD_REQUEST,
    );
  }
  const body = parseResult.data;

  const pausedState = (await stateStorage.get(`paused:${body.approvalId}`)) as unknown as PausedMissionState | null;
  if (!pausedState) {
    return c.json({ error: MISSION_ERROR_MESSAGES.APPROVAL_EXPIRED_OR_NOT_FOUND }, HTTP_STATUS.NOT_FOUND);
  }

  await stateStorage.delete(`paused:${body.approvalId}`);

  const { state, pendingToolCall, harnessSnapshot, metadata } = pausedState;

  if (body.decision === HITL_DECISIONS.APPROVE) {
    const toolMap = toolRegistry.resolveToolsMap(harnessSnapshot.toolNames);
    const tool = toolMap.get(pendingToolCall.name);

    let observation: Observation;
    if (tool) {
      observation = await tool.execute(pendingToolCall.args);
    } else {
      observation = { status: ERROR_STATUS, summary: `Tool ${pendingToolCall.name} not found.` };
    }

    const toolCallId = `tool_approved_${Date.now()}`;
    state.messages.push(
      new AIMessage({
        content: "",
        tool_calls: [{ id: toolCallId, name: pendingToolCall.name, args: pendingToolCall.args, type: "tool_call" }],
      }),
    );
    state.messages.push(new ToolMessage({ tool_call_id: toolCallId, content: observation.summary }));
  } else {
    state.messages.push(
      new HumanMessage(
        `USER INTERVENTION: Execution of tool "${pendingToolCall.name}" was denied. Reason: ${body.reason || "Permission denied"}. Find an alternative solution.`,
      ),
    );
  }

  const provider = ProviderFactory.fromConfig(harnessSnapshot.providerConfig as ProviderConnectionConfig);
  const strategy = StrategyFactory.create(harnessSnapshot.strategyName);

  const harness = new NlahHarness({
    missionId,
    provider,
    strategy,
    harnessConfig: harnessSnapshot.featureToggles,
    initialCostUsd: metadata.totalCostUsd,
    delegationDepth: harnessSnapshot.delegationDepth,
  });

  harness.restoreLoopDetectorHistory(metadata.loopDetectorHistory);

  return streamHarnessExecution(c, {
    missionId,
    state,
    harness,
    executionLog: STREAM_LOG_MESSAGES.RESUME_EXECUTION_FAILED,
    sendErrorLog: STREAM_LOG_MESSAGES.SEND_RESUME_ERROR_FAILED,
  });
}

async function streamHarnessExecution(
  c: Context,
  opts: {
    missionId: string;
    state: AgentState;
    harness: NlahHarness;
    executionLog: string;
    sendErrorLog: string;
  },
) {
  return streamSSE(c, async (streamInstance) => {
    const transport = new HttpStreamTransport(streamInstance);

    const signal = cancellationManager.register(opts.missionId);
    streamInstance.onAbort(() => {
      cancellationManager.cancelLocal(opts.missionId);
    });

    try {
      await opts.harness.runMission(opts.state, async (packet: HarnessEvent) => {
        if (signal.aborted) {
          throw new Error(STREAM_CONSTANTS.CANCELLED_MESSAGE);
        }
        await transport.send(packet);
      });
    } catch (streamErr: unknown) {
      const errorMessage = streamErr instanceof Error ? streamErr.message : String(streamErr);
      logger.error(`${opts.executionLog} ${errorMessage}`);
      try {
        await transport.send({
          type: ERROR_STATUS,
          missionId: opts.missionId,
          step: STREAM_CONSTANTS.ERROR_STEP,
          content: errorMessage,
          code: STREAM_CONSTANTS.ERROR_CODE,
        });
      } catch (sendErr) {
        logger.warn(`${opts.sendErrorLog} ${sendErr}`);
      }
    } finally {
      cancellationManager.unregister(opts.missionId);
    }
  });
}
