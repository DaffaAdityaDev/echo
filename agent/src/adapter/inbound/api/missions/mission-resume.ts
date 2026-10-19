import { randomUUID } from "node:crypto";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { Context } from "hono";
import { cancellationManager, NlahHarness } from "../../../../core/agent/harness";
import { HARNESS_CONFIG } from "../../../../core/agent/harness/constants";
import { validateToolArgs } from "../../../../core/agent/harness/tool-args";
import { applyBoundTools } from "../../../../core/agent/prompts/bound-tools";
import { stateStorage } from "../../../../core/agent/storage";
import { pausedStateKey } from "../../../../core/agent/storage/state-key";
import { StrategyFactory } from "../../../../core/agent/strategies";
import { createRestTool, toolRegistry } from "../../../../core/agent/tools";
import { isProviderConnectionConfig, ProviderFactory } from "../../../../infrastructure/providers/factory";
import { ERROR_STATUS } from "../../../../shared/constants/errors";
import { HTTP_STATUS } from "../../../../shared/constants/http";
import type { AgentState, Observation, PausedMissionState, ToolDefinition } from "../../../../shared/types";
import { logger } from "../../../../shared/utils/logger";
import { ApprovalClaimRegistry } from "./approval-claims";
import { HITL_DECISIONS, MISSION_ERROR_MESSAGES, STREAM_LOG_MESSAGES } from "./mission.constants";
import { type HitlDecisionInput, hitlDecisionSchema } from "./mission.schema";
import { reserveMissionRun, streamHarnessExecution } from "./mission-execution";

const approvalClaims = new ApprovalClaimRegistry(HARNESS_CONFIG.PAUSED_STATE_TTL_SECONDS * 1000);

function isPausedMissionState(val: AgentState | PausedMissionState | null): val is PausedMissionState {
  return val != null && "pendingToolCall" in val && "harnessSnapshot" in val;
}

/**
 * Loads the paused state and claims it for this request. An approval bound to
 * another session, or already claimed by a concurrent decision, is reported
 * as not found so it cannot be replayed or used across sessions.
 */
async function claimPausedState(missionId: string, approvalId: string): Promise<PausedMissionState | null> {
  const storageKey = pausedStateKey(missionId, approvalId);
  const rawState = await stateStorage.get(storageKey);

  if (!isPausedMissionState(rawState) || rawState.missionId !== missionId) return null;

  if (!approvalClaims.tryClaim(approvalId)) return null;

  try {
    await stateStorage.delete(storageKey);
  } catch (err: unknown) {
    approvalClaims.release(approvalId);
    throw err;
  }

  return rawState;
}

async function executeApprovedTool(
  pendingToolCall: PausedMissionState["pendingToolCall"],
  harnessSnapshot: PausedMissionState["harnessSnapshot"],
): Promise<Observation> {
  const toolMap = new Map<string, ToolDefinition>();

  for (const [name, tool] of toolRegistry.resolveToolsMap(harnessSnapshot.toolNames)) {
    toolMap.set(name, tool);
  }

  for (const restConfig of harnessSnapshot.restTools ?? []) {
    toolMap.set(restConfig.name, createRestTool(restConfig));
  }

  const tool = toolMap.get(pendingToolCall.name);

  if (!tool) {
    return { status: ERROR_STATUS, summary: `Tool ${pendingToolCall.name} not found.` };
  }

  const invalidArgs = validateToolArgs(tool, pendingToolCall.args);

  if (invalidArgs) return invalidArgs;

  try {
    return await tool.execute(pendingToolCall.args);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(`Approved tool execution failed for ${pendingToolCall.name}: ${errMsg}`);

    return {
      status: ERROR_STATUS,
      summary: `Tool execution failed: ${pendingToolCall.name} raised an error after approval: ${errMsg}`,
      error: "TOOL_EXECUTION_FAILED",
    };
  }
}

export async function handleHitlDecision(c: Context) {
  const missionId = c.req.param("id") ?? "";

  const parseResult = hitlDecisionSchema.safeParse(await c.req.json());

  if (!parseResult.success) {
    logger.error("Invalid HITL decision payload", parseResult.error.format());

    return c.json(
      { error: MISSION_ERROR_MESSAGES.INVALID_DECISION, details: parseResult.error.format() },
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  // The run slot is reserved before the approval is consumed, so a still-running
  // turn yields a retryable 409 instead of losing the approval or its tool result.
  const reservedSignal = reserveMissionRun(missionId);

  if (!reservedSignal) {
    return c.json({ error: MISSION_ERROR_MESSAGES.MISSION_ALREADY_RUNNING }, HTTP_STATUS.CONFLICT);
  }

  try {
    return await resumeReservedMission(c, missionId, parseResult.data, reservedSignal);
  } catch (err: unknown) {
    cancellationManager.unregister(missionId, reservedSignal);
    throw err;
  }
}

async function resumeReservedMission(
  c: Context,
  missionId: string,
  body: HitlDecisionInput,
  reservedSignal: AbortSignal,
) {
  const pausedState = await claimPausedState(missionId, body.approvalId);

  if (!pausedState) {
    cancellationManager.unregister(missionId, reservedSignal);

    return c.json({ error: MISSION_ERROR_MESSAGES.APPROVAL_EXPIRED_OR_NOT_FOUND }, HTTP_STATUS.NOT_FOUND);
  }

  // A cancelled mission must not be resumable: the run was stopped (user
  // interrupt or disconnect), so a late approval would otherwise resurrect a
  // dead execution on a fresh harness.
  if (cancellationManager.isCancelled(missionId)) {
    cancellationManager.unregister(missionId, reservedSignal);

    return c.json({ error: MISSION_ERROR_MESSAGES.MISSION_CANCELLED }, HTTP_STATUS.CONFLICT);
  }

  const { state, pendingToolCall, harnessSnapshot, metadata } = pausedState;

  if (body.decision === HITL_DECISIONS.APPROVE) {
    const observation = await executeApprovedTool(pendingToolCall, harnessSnapshot);

    const toolCallId = `tool_approved_${randomUUID()}`;
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

  const providerConfig =
    body.provider_config ??
    (isProviderConnectionConfig(harnessSnapshot.providerConfig) ? harnessSnapshot.providerConfig : null);

  if (!providerConfig) {
    cancellationManager.unregister(missionId, reservedSignal);

    return c.json({ error: MISSION_ERROR_MESSAGES.PROVIDER_CONFIG_REQUIRED }, HTTP_STATUS.BAD_REQUEST);
  }

  const provider = ProviderFactory.fromConfig({
    type: providerConfig.type,
    base_url: providerConfig.base_url,
    model: providerConfig.model,
    api_key: providerConfig.api_key ?? undefined,
    max_context_tokens: providerConfig.max_context_tokens,
  });

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
    reservedSignal,
  });
}
