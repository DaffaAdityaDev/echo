import { randomUUID } from "node:crypto";
import { HumanMessage } from "@langchain/core/messages";
import type { Context } from "hono";
import { StandardContextAnchor } from "../../../../core/agent/anchors";
import { NlahHarness } from "../../../../core/agent/harness";
import { type BehaviorPrompt, resolveBehaviorPrompt } from "../../../../core/agent/prompts";
import { applyBoundTools } from "../../../../core/agent/prompts/bound_tools";
import { SkillRegistry } from "../../../../core/agent/skills";
import { stateStorage } from "../../../../core/agent/storage";
import { strategyRegistry } from "../../../../core/agent/strategies";
import { createRestTool, getImplementedFeatures, toolRegistry } from "../../../../core/agent/tools";
import { ProviderFactory } from "../../../../infrastructure/providers/factory";
import type { RestToolConfig } from "../../../../infrastructure/transports/rest/types";
import { HTTP_STATUS } from "../../../../shared/constants/http";
import type { MissionPayload, ToolDefinition } from "../../../../shared/types";
import { logger } from "../../../../shared/utils/logger";
import { mapHistoryToMessages } from "../../../../shared/utils/messages";
import {
  MISSION_ERROR_MESSAGES,
  MISSION_LOG_MESSAGES,
  STREAM_LOG_MESSAGES,
  VALIDATION_MESSAGES,
} from "./mission.constants";
import { createMissionSchema } from "./mission.schema";
import { handleHitlDecision } from "./mission-resume";
import {
  __setEmptyStreamIdleMsForTest,
  __setPartialHistoryIdleMsForTest,
  streamHarnessExecution,
  streamMissionLogs,
} from "./mission-stream";

export { __setEmptyStreamIdleMsForTest, __setPartialHistoryIdleMsForTest, handleHitlDecision, streamMissionLogs };

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
