import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { Context } from "hono";
import { NlahHarness } from "../../../../core/agent/harness";
import { applyBoundTools } from "../../../../core/agent/prompts/bound_tools";
import { stateStorage } from "../../../../core/agent/storage";
import { StrategyFactory } from "../../../../core/agent/strategies";
import { createRestTool, toolRegistry } from "../../../../core/agent/tools";
import { type ProviderConnectionConfig, ProviderFactory } from "../../../../infrastructure/providers/factory";
import { ERROR_STATUS } from "../../../../shared/constants/errors";
import { HTTP_STATUS } from "../../../../shared/constants/http";
import type { Observation, PausedMissionState, ToolDefinition } from "../../../../shared/types";
import { logger } from "../../../../shared/utils/logger";
import { HITL_DECISIONS, MISSION_ERROR_MESSAGES, STREAM_LOG_MESSAGES } from "./mission.constants";
import { hitlDecisionSchema } from "./mission.schema";
import { streamHarnessExecution } from "./mission-execution";

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
