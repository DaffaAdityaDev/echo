import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { LangfuseSpan } from "@langfuse/tracing";
import { ENV } from "../../../config/env";
import { ProviderFactory } from "../../../infrastructure/providers/factory";
import { calculateUsageCost } from "../../../infrastructure/providers/utils";
import type { RestToolConfig } from "../../../infrastructure/transports/rest/types";
import { CANCELLED_MESSAGE } from "../../../shared/constants/errors";
import type { AgentState, HarnessFeatureToggles, LLMProvider, ToolDefinition } from "../../../shared/types";
import { getCosineSimilarity } from "../../../shared/utils/harness";
import { langfuseStorage } from "../../../shared/utils/langfuse";
import { logger } from "../../../shared/utils/logger";
import type { BehaviorPrompt } from "../prompts";
import { stateStorage } from "../storage/factory";
import type { BudgetMonitor } from "./budget_monitor";
import { cancellationManager } from "./cancel_manager";
import type { CircuitBreaker } from "./circuit_breaker";
import { DEBUG_CONFIG, HARNESS_CONFIG, PACKET_TYPES } from "./constants";
import type { ContentSanitizer } from "./content_sanitizer";
import type { ContextManager } from "./context_manager";
import { queuePromptDebug } from "./debug";
import type { DegradationLevel, DegradationManager } from "./degradation";
import type { HarnessEventEmitter } from "./events";
import type { HitlGuard } from "./hitl_guard";
import type { LoopDetector } from "./loop_detector";
import { HARNESS_PROMPTS } from "./prompts";
import type { RecoveryHandler, StrategyRef } from "./recovery";
import type { AgentStatusTracker } from "./status-tracker";
import { processStreamEvents } from "./stream-processor";
import type { ToolExecutor } from "./tool-executor";
import type { HarnessEvent, HarnessRuntimeConfig } from "./types";

export interface TurnRuntime {
  isComplete: boolean;
  currentSystemPrompt: string;
  currentToolMap: Map<string, ToolDefinition>;
  lastDegradationLevel: DegradationLevel;
  totalInputTokensSum: number;
  previousThought: string;
}

export interface TurnRunnerDeps {
  provider: LLMProvider;
  strategyRef: StrategyRef;
  emitter: HarnessEventEmitter;
  recovery: RecoveryHandler;
  contextManager: ContextManager;
  contentSanitizer: ContentSanitizer;
  loopDetector: LoopDetector;
  hitlGuard: HitlGuard;
  toolExecutor: ToolExecutor;
  featureToggles: HarnessFeatureToggles;
  harnessConfig?: HarnessRuntimeConfig;
  tenantId: string;
  restTools: RestToolConfig[];
  delegationDepth: number;
  behaviorPrompt: BehaviorPrompt | null;
  getMissionId: () => string;
  getPacingEnabled: () => boolean;
  setPacingForced: (value: boolean) => void;
  getLoopDetectionEnabled: () => boolean;
  getTotalCostUsd: () => number;
  addTotalCostUsd: (stepCost: number) => void;
  getStatusTracker: () => AgentStatusTracker | undefined;
}

export class TurnRunner {
  constructor(private readonly deps: TurnRunnerDeps) {}

  private async emitDebugPackets(
    state: AgentState,
    systemPrompt: string,
    iteration: number,
    onPacket: (p: HarnessEvent) => Promise<void>,
  ): Promise<void> {
    if (!ENV.DEBUG_PROMPT && ENV.NODE_ENV !== DEBUG_CONFIG.ENV) return;
    queuePromptDebug({ state, iteration, strategyName: this.deps.strategyRef.current.name, systemPrompt });
    logger.info(`📓 Prompt debug operations queued in background`);
    try {
      await this.deps.emitter.emitDebug(
        onPacket,
        iteration,
        systemPrompt,
        state.messages.length,
        state.messages.map((m) => ({ role: m._getType(), content: m.content as string })),
      );
    } catch (emitErr) {
      logger.error("Failed to emit debug packet", emitErr);
    }
  }

  async runTurn(
    state: AgentState,
    onPacket: (p: HarnessEvent) => Promise<void>,
    iteration: number,
    trace: LangfuseSpan | null,
    span: LangfuseSpan | null,
    circuit: CircuitBreaker,
    degradation: DegradationManager,
    budgetMonitor: BudgetMonitor,
    tools: ToolDefinition[],
    maxContextTokens: number,
    runtime: TurnRuntime,
  ): Promise<void> {
    await langfuseStorage.run({ trace, span, sessionId: state.missionId, userId: this.deps.tenantId }, async () => {
      try {
        if (degradation.shouldAbort()) {
          const errMsg = `ABORT: Execution failed due to ${degradation.getConsecutiveFailures()} consecutive tool errors.`;
          logger.error(errMsg);
          await this.deps.emitter.updateStatus(onPacket, { state: "aborted" }, iteration);
          throw new Error(errMsg);
        }

        const result = await this.deps.recovery.handleDegradation(
          state,
          degradation,
          runtime.lastDegradationLevel,
          iteration,
          onPacket,
        );
        if (result.systemPrompt) runtime.currentSystemPrompt = result.systemPrompt;
        if (result.toolMap.size > 0 || result.lastDegradationLevel !== runtime.lastDegradationLevel)
          runtime.currentToolMap = result.toolMap;
        runtime.lastDegradationLevel = result.lastDegradationLevel;

        const currentLevel = degradation.getLevel();
        const activeCircuitBreakers = circuit.getAllOpenCircuits();
        const currentStrategyStr =
          this.deps.strategyRef.current.name === "standard"
            ? "standard"
            : currentLevel === "restricted"
              ? "restricted"
              : "agent";
        await this.deps.emitter.updateStatus(
          onPacket,
          {
            state: currentLevel !== "normal" ? "degraded" : "running",
            step: iteration,
            strategy: currentStrategyStr,
            activeCircuitBreakers,
            consecutiveFailures: degradation.getConsecutiveFailures(),
          },
          iteration,
        );

        if (this.deps.getPacingEnabled() && iteration > HARNESS_CONFIG.PACING_THRESHOLD) {
          logger.warn(`Cognitive pacing threshold crossed (iteration: ${iteration}). Injecting forced synthesis.`);
          state.messages.push(new HumanMessage(HARNESS_PROMPTS.PACING_WARNING(iteration)));
          this.deps.setPacingForced(true);
          runtime.currentToolMap = new Map();
        }

        // BUDGET CHECK
        const budgetCheck = budgetMonitor.checkBudget(iteration, this.deps.getTotalCostUsd());
        if (budgetCheck.exceeded) {
          logger.warn(`[NlahHarness] Budget threshold crossed: ${budgetCheck.message}`);
          if (
            this.deps.featureToggles.systemNotices.enabled &&
            this.deps.featureToggles.systemNotices.emitBudgetWarnings
          ) {
            await this.deps.emitter.emitSystemNotice(
              onPacket,
              iteration,
              "BUDGET_WARNING",
              budgetCheck.message as string,
              "error",
            );
          }
          await this.deps.emitter.updateStatus(onPacket, { state: "aborted" }, iteration);
          if (span) {
            span.update({ output: { status: "budget_aborted", reason: budgetCheck.reason } });
            span.end();
          }
          runtime.isComplete = true;
          return;
        }

        await this.deps.recovery.handleCompaction(state, iteration, onPacket);
        await this.emitDebugPackets(state, runtime.currentSystemPrompt, iteration, onPacket);

        const activeTools = currentLevel !== "normal" ? [] : tools;
        const dynamicEnvContext = `Current Time: ${new Date().toISOString()} | Session: ${state.missionId}`;
        const preparedMessages = this.deps.contextManager.prepareMessagesPayload(
          runtime.currentSystemPrompt,
          dynamicEnvContext,
          state.messages,
        );
        const eventStream = this.deps.provider.stream(
          preparedMessages,
          activeTools,
          runtime.currentSystemPrompt,
          cancellationManager.getSignal(this.deps.getMissionId()),
        );

        const { assistantContent, reasoningContent, pendingToolCall, hasContentEmitted, usage } =
          await processStreamEvents({
            eventStream,
            iteration,
            onPacket,
            emitter: this.deps.emitter,
            provider: this.deps.provider,
            contentSanitizer: this.deps.contentSanitizer,
            statusTracker: this.deps.getStatusTracker(),
            harnessConfig: this.deps.harnessConfig,
          });

        // ACCUMULATE ACTUAL COST
        if (usage) {
          const { stepCost } = calculateUsageCost(
            this.deps.provider.modelName ?? "unknown",
            this.deps.provider.baseURL ?? "",
            usage.promptTokens,
            usage.completionTokens,
            usage.cachedTokens ?? 0,
          );
          this.deps.addTotalCostUsd(stepCost);
          runtime.totalInputTokensSum += usage.promptTokens;
        }

        // LAYER 2: SEMANTIC LOOP DETECTION (Cosine Similarity) — existing behavior preserved
        if (runtime.previousThought && assistantContent) {
          const sim = getCosineSimilarity(runtime.previousThought, assistantContent);
          logger.info(`Semantic cosine similarity calculated: ${sim.toFixed(4)}`);
          if (this.deps.getLoopDetectionEnabled() && sim >= HARNESS_CONFIG.SIMILARITY_THRESHOLD) {
            logger.langfuse(
              "WARN",
              `Semantic similarity threshold crossed (sim: ${sim.toFixed(4)}). Injecting loop warning.`,
            );
            state.messages.push(new HumanMessage(HARNESS_PROMPTS.REPEATING_WARNING));
            await this.deps.emitter.updateStatus(onPacket, { state: "looping" }, iteration);
          }
        }
        runtime.previousThought = assistantContent;

        let toolCallResult: { name: string; args: Record<string, unknown> } | null = pendingToolCall;

        // LAYER 1: EXACT TOOL CALL LOOP DETECTION (MD5 Hash Ring Buffer)
        if (
          toolCallResult &&
          this.deps.featureToggles.loopDetection.enabled &&
          this.deps.featureToggles.loopDetection.enableExactMatch
        ) {
          const loopResult = this.deps.loopDetector.recordAndCheck(toolCallResult.name, toolCallResult.args);
          if (loopResult.isLoop) {
            logger.warn(`[NlahHarness] Exact tool call loop detected for ${toolCallResult.name}`);
            if (
              this.deps.featureToggles.systemNotices.enabled &&
              this.deps.featureToggles.systemNotices.emitLoopWarnings
            ) {
              await this.deps.emitter.emitSystemNotice(
                onPacket,
                iteration,
                "LOOP_DETECTED",
                `Tool "${toolCallResult.name}" called ${loopResult.count}x consecutively with identical arguments.`,
                "warning",
              );
            }
            state.messages.push(
              new ToolMessage({
                tool_call_id: `loop_warn_${Date.now()}`,
                content: `SYSTEM INTERVENTION: You called tool "${toolCallResult.name}" with identical arguments ${loopResult.count}x. Stop this call chain and try a different approach.`,
              }),
            );
            toolCallResult = null;
          }
        }

        // HITL PROTECTION GUARD
        if (toolCallResult && this.deps.hitlGuard.isProtected(toolCallResult.name)) {
          logger.info(`[NlahHarness] HITL approval required for protected tool: ${toolCallResult.name}`);
          const approval = this.deps.hitlGuard.createApprovalPayload(this.deps.getMissionId(), state.missionId, {
            id: `tool_${Date.now()}`,
            name: toolCallResult.name,
            args: toolCallResult.args,
          });
          await stateStorage.set(
            `paused:${approval.approvalId}`,
            {
              approvalId: approval.approvalId,
              missionId: this.deps.getMissionId(),
              sessionId: state.missionId,
              pendingToolCall: {
                id: approval.toolCall.id,
                name: approval.toolCall.name,
                args: approval.toolCall.args,
              },
              state,
              harnessSnapshot: {
                strategyName: this.deps.strategyRef.current.name,
                toolNames: Array.from(runtime.currentToolMap.keys()),
                restTools: this.deps.restTools,
                providerConfig: {
                  type: ProviderFactory.resolveType(this.deps.provider) ?? "unknown",
                  base_url: this.deps.provider.baseURL ?? "",
                  api_key: null,
                  model: this.deps.provider.modelName ?? "unknown",
                },
                delegationDepth: this.deps.delegationDepth,
                featureToggles: this.deps.featureToggles,
                behaviorPrompt: this.deps.behaviorPrompt,
              },
              metadata: {
                totalCostUsd: this.deps.getTotalCostUsd(),
                loopDetectorHistory: this.deps.loopDetector.getHistory(),
                pausedAt: new Date().toISOString(),
                expiresAt: approval.expiresAt,
              },
            },
            HARNESS_CONFIG.PAUSED_STATE_TTL_SECONDS,
          );
          await onPacket({
            type: PACKET_TYPES.HITL_APPROVAL_REQUIRED,
            timestamp: Date.now(),
            missionId: this.deps.getMissionId(),
            step: iteration,
            payload: {
              approvalId: approval.approvalId,
              toolName: toolCallResult.name,
              args: toolCallResult.args,
              riskLevel: "high",
              expiresAt: approval.expiresAt,
            },
          });
          if (span) {
            span.update({ output: { status: "PAUSED_AWAITING_APPROVAL", toolName: toolCallResult.name } });
            span.end();
          }
          return;
        }

        if (toolCallResult) {
          logger.info(`[runMission] Iter ${iteration}: executing toolCall ${toolCallResult.name}`);
          await this.deps.toolExecutor.execute(
            toolCallResult,
            runtime.currentToolMap,
            assistantContent,
            reasoningContent,
            iteration,
            onPacket,
            state,
            circuit,
            degradation,
            runtime.totalInputTokensSum,
            maxContextTokens,
          );
        } else if (!hasContentEmitted && assistantContent) {
          await this.deps.emitter.emitContent(onPacket, iteration, assistantContent);
        } else {
          logger.info(
            `[runMission] Iter ${iteration}: no toolCall — entering autoRecovery (contentLen=${assistantContent.length}, hasContentEmitted=${hasContentEmitted})`,
          );
          const { isComplete: turnComplete, retryWithTool } = await this.deps.recovery.handleAutoRecovery(
            assistantContent,
            reasoningContent,
            iteration,
            state,
            runtime.currentToolMap,
          );
          runtime.isComplete = turnComplete;
          if (retryWithTool) {
            await this.deps.toolExecutor.execute(
              retryWithTool,
              runtime.currentToolMap,
              assistantContent,
              reasoningContent,
              iteration,
              onPacket,
              state,
              circuit,
              degradation,
              runtime.totalInputTokensSum,
              maxContextTokens,
            );
          }
          if (!runtime.isComplete && !hasContentEmitted && assistantContent) {
            await this.deps.emitter.emitContent(onPacket, iteration, assistantContent);
          }
        }

        if (span) {
          span.update({
            output: {
              thought: assistantContent,
              toolCalls: pendingToolCall ? [{ name: pendingToolCall.name, args: pendingToolCall.args }] : [],
            },
          });
          span.end();
        }
        await stateStorage.set(state.missionId, state, HARNESS_CONFIG.STATE_TTL_SECONDS);
      } catch (err: unknown) {
        if (
          cancellationManager.isAborted(this.deps.getMissionId()) ||
          cancellationManager.isCancelled(this.deps.getMissionId())
        ) {
          logger.info(`NlahHarness: Mission ${this.deps.getMissionId()} aborted mid-turn, surfacing as cancellation.`);
          if (span) {
            span.update({ output: { status: "interrupted", reason: CANCELLED_MESSAGE } });
            span.end();
          }
          throw new Error(CANCELLED_MESSAGE);
        }
        const turnError = err as { message?: string; stack?: string };
        logger.langfuse("ERROR", `Turn execution failed: ${turnError.message}`, {
          error: turnError.stack || turnError.message,
        });
        if (span) {
          span.update({
            level: "ERROR",
            statusMessage: turnError.message,
          });
          span.end();
        }
        throw err;
      }
    });
  }
}
