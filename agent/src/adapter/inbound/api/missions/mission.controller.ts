import { randomUUID } from "node:crypto";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { StandardContextAnchor } from "../../../../core/agent/anchors";
import { cancellationManager, NlahHarness } from "../../../../core/agent/harness";
import type { HarnessEvent } from "../../../../core/agent/harness/types";
import { type BehaviorPrompt, resolveBehaviorPrompt } from "../../../../core/agent/prompts";
import { applyBoundTools } from "../../../../core/agent/prompts/bound_tools";
import { SkillRegistry } from "../../../../core/agent/skills";
import { stateStorage } from "../../../../core/agent/storage";
import { StrategyFactory, strategyRegistry } from "../../../../core/agent/strategies";
import { createRestTool, getImplementedFeatures, toolRegistry } from "../../../../core/agent/tools";
import { isRedisAvailable } from "../../../../infrastructure/cache/redis";
import { type ProviderConnectionConfig, ProviderFactory } from "../../../../infrastructure/providers/factory";
import type { RestToolConfig } from "../../../../infrastructure/transports/rest/types";
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
import { getHistory, getLastEvent, isTerminalPacket, recordEvent, subscribe } from "./mission-stream";
import { HttpStreamTransport, type StreamPacket } from "./stream.transport";

function toRestToolConfig(restTool: {
  name: string;
  endpoint: string;
  url?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  description: string;
  headers?: Record<string, string>;
  global_headers?: Record<string, string>;
  inputSchema: Record<string, unknown>;
  auth?: { type: "bearer" | "basic" | "header"; credentials: Record<string, string> };
  timeout?: number;
  url_interpolation?: boolean;
}): RestToolConfig {
  return {
    name: restTool.name,
    description: restTool.description,
    endpoint: restTool.endpoint,
    url: restTool.url,
    method: restTool.method ?? "POST",
    headers: restTool.headers,
    global_headers: restTool.global_headers,
    schema: restTool.inputSchema as RestToolConfig["schema"],
    auth: restTool.auth,
    timeout: restTool.timeout ?? 30000,
    url_interpolation: restTool.url_interpolation ?? false,
  };
}

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

    // REST tools are scoped to THIS mission only. They are built as standalone
    // definitions and appended to the resolved tool set — never registered into
    // the process-global registry, which would leak the tool (and its headers)
    // into every subsequent mission on this agent.
    const restConfigs = (validatedData.config?.restTools ?? []).map(toRestToolConfig);
    if (restConfigs.length > 0) {
      const restDefs = restConfigs.map(createRestTool);
      resolvedTools = resolvedTools ? [...resolvedTools, ...restDefs] : restDefs;
    }

    let behaviorPrompt: BehaviorPrompt | null = null;
    try {
      behaviorPrompt = await resolveBehaviorPrompt({
        templateName: validatedData.prompt_template,
        tenantId: payload.tenant.tenantId,
      });
    } catch (promptErr: unknown) {
      logger.warn("Prompt resolution failed; falling back to default behavior", promptErr);
    }

    if (behaviorPrompt && behaviorPrompt.boundTools.length > 0 && resolvedTools !== undefined) {
      resolvedTools = applyBoundTools(resolvedTools, behaviorPrompt.boundTools);
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
      restTools: restConfigs,
      skills: validatedData.skills ?? undefined,
      harnessConfig: validatedData.config.featureToggles ?? validatedData.config.harnessConfig,
      delegationDepth: validatedData.config.harness.delegationDepth,
      behaviorPrompt,
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
    const toolMap = new Map<string, ToolDefinition>();
    for (const [name, tool] of toolRegistry.resolveToolsMap(harnessSnapshot.toolNames)) {
      toolMap.set(name, tool);
    }
    for (const restConfig of harnessSnapshot.restTools ?? []) {
      toolMap.set(restConfig.name, createRestTool(restConfig));
    }
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

  const behaviorPrompt = harnessSnapshot.behaviorPrompt ?? null;
  const restoredRestTools = (harnessSnapshot.restTools ?? []).map(createRestTool);
  const restoredTools = applyBoundTools(
    Array.from(toolRegistry.resolveToolsMap(harnessSnapshot.toolNames).values()),
    behaviorPrompt?.boundTools ?? [],
  );
  if (restoredRestTools.length > 0) {
    restoredTools.push(...restoredRestTools);
  }

  const harness = new NlahHarness({
    missionId,
    provider,
    strategy,
    tools: restoredTools,
    restTools: harnessSnapshot.restTools ?? [],
    harnessConfig: harnessSnapshot.featureToggles,
    initialCostUsd: metadata.totalCostUsd,
    delegationDepth: harnessSnapshot.delegationDepth,
    behaviorPrompt,
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

    let completedCleanly = false;

    try {
      await opts.harness.runMission(opts.state, async (packet: HarnessEvent) => {
        if (signal.aborted) {
          throw new Error(STREAM_CONSTANTS.CANCELLED_MESSAGE);
        }
        const enriched = await transport.send(packet);
        await recordEvent(opts.missionId, enriched);
      });
      completedCleanly = true;
    } catch (streamErr: unknown) {
      const errorMessage = streamErr instanceof Error ? streamErr.message : String(streamErr);
      logger.error(`${opts.executionLog} ${errorMessage}`);
      try {
        const errorPacket = {
          type: ERROR_STATUS,
          missionId: opts.missionId,
          step: STREAM_CONSTANTS.ERROR_STEP,
          content: errorMessage,
          code: STREAM_CONSTANTS.ERROR_CODE,
        };
        await transport.send(errorPacket);
        await recordEvent(opts.missionId, errorPacket);
      } catch (sendErr) {
        logger.warn(`${opts.sendErrorLog} ${sendErr}`);
      }
    } finally {
      cancellationManager.unregister(opts.missionId);
      // Only a clean completion gets the terminal "completed" marker. A
      // cancelled/errored run already recorded an error packet, which replay
      // treats as terminal — stamping it "completed" too would make a
      // cancelled mission replay as a success.
      if (completedCleanly) {
        await recordEvent(opts.missionId, {
          type: "mission_completed",
          missionId: opts.missionId,
        });
      }
    }
  });
}

export async function streamMissionLogs(c: Context) {
  const missionId = c.req.param("id") as string;
  if (!missionId) {
    return c.json({ error: MISSION_ERROR_MESSAGES.MISSION_ID_REQUIRED }, HTTP_STATUS.BAD_REQUEST);
  }

  if (!isRedisAvailable()) {
    return c.json({ error: MISSION_ERROR_MESSAGES.STREAM_UNAVAILABLE }, HTTP_STATUS.SERVICE_UNAVAILABLE);
  }

  const after = c.req.query("after") || c.req.header("Last-Event-ID") || undefined;

  return streamSSE(c, async (streamInstance) => {
    let cleanup = () => {};
    let finished = false;
    let resolveDone = () => {};

    const finish = () => {
      if (finished) return;
      finished = true;
      cleanup();
    };

    const done = () => {
      finish();
      resolveDone();
    };

    const write = async (event: { sid: string; packet: StreamPacket }) => {
      await streamInstance.writeSSE({ data: JSON.stringify({ ...event.packet, sid: event.sid }) });
      if (isTerminalPacket(event.packet)) {
        done();
      }
    };

    const history = await getHistory(missionId, after);
    for (const event of history) {
      if (finished) return;
      await write(event);
    }
    if (finished) return;

    // Stream already ended (terminal marker before the cursor): close instead
    // of blocking forever on subscribe.
    const lastEvent = await getLastEvent(missionId);
    if (lastEvent && isTerminalPacket(lastEvent.packet)) {
      return;
    }

    // A stream with no terminal marker is either a mission that just started
    // (first event not yet recorded), one whose Redis stream expired after the
    // 24h TTL, or one whose agent died mid-run. None of these will produce a
    // terminal packet, so close after an idle window instead of blocking
    // forever:
    //   - Empty history: a single-shot window for the expired/TTL case. The
    //     first live event proves the mission is genuinely running, so it
    //     cancels the timer (a live mission must never be cut off on silence).
    //   - Partial history: a sliding window reset on every live event, so a
    //     mission whose agent died mid-run closes instead of hanging forever.
    const idleMs =
      history.length === 0
        ? (emptyStreamIdleMs ?? STREAM_CONSTANTS.EMPTY_STREAM_IDLE_MS)
        : (partialHistoryIdleMs ?? STREAM_CONSTANTS.PARTIAL_HISTORY_IDLE_MS);

    let idleTimer: NodeJS.Timeout | undefined;
    const scheduleIdleClose = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(done, idleMs);
    };
    const cancelIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = undefined;
      }
    };

    const unsubscribe = subscribe(
      missionId,
      (event) => {
        if (history.length === 0) {
          cancelIdleTimer();
        } else {
          scheduleIdleClose();
        }
        write(event).catch(done);
      },
      history.length > 0 ? history[history.length - 1].sid : undefined,
    );

    scheduleIdleClose();

    // Replayed history is done; signal the client so it can switch from
    // replay (skip already-applied content) to live (apply content deltas).
    // Sent before the first live event can be delivered: subscribe's XREAD
    // callback is asynchronous, and the history was already written above.
    await streamInstance.writeSSE({ data: JSON.stringify({ type: STREAM_CONSTANTS.REPLAY_DONE_TYPE }) });

    const heartbeat = setInterval(() => {
      streamInstance.write(": heartbeat\n\n").catch(done);
    }, STREAM_CONSTANTS.HEARTBEAT_INTERVAL_MS);

    cleanup = () => {
      clearInterval(heartbeat);
      cancelIdleTimer();
      unsubscribe();
    };

    streamInstance.onAbort(done);
    c.req.raw.signal.addEventListener("abort", done);

    await new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
  });
}

let emptyStreamIdleMs: number | null = null;
let partialHistoryIdleMs: number | null = null;

export function __setEmptyStreamIdleMsForTest(ms: number | null) {
  emptyStreamIdleMs = ms;
}

export function __setPartialHistoryIdleMsForTest(ms: number | null) {
  partialHistoryIdleMs = ms;
}
