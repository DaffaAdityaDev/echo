import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { LangfuseSpan } from "@langfuse/tracing";
import { context, trace as otelTrace } from "@opentelemetry/api";
import { ENV } from "../../../config/env";
import { ProviderFactory } from "../../../infrastructure/providers/factory";
import { calculateUsageCost } from "../../../infrastructure/providers/utils";
import type { RestToolConfig } from "../../../infrastructure/transports/rest/types";
import { CANCELLED_MESSAGE } from "../../../shared/constants/errors";
import type { AgentState, HarnessFeatureToggles, LLMProvider, ToolDefinition } from "../../../shared/types";
import { getCosineSimilarity } from "../../../shared/utils/harness";
import { langfuseStorage, startAgentTrace } from "../../../shared/utils/langfuse";
import { logger } from "../../../shared/utils/logger";
import type { BehaviorPrompt } from "../prompts";
import { applyBoundTools } from "../prompts/bound_tools";
import { ToolRetriever } from "../services/retriever";
import { SkillRegistry } from "../skills";
import { stateStorage } from "../storage/factory";
import { toolRegistry } from "../tools/registry";
import { BudgetMonitor } from "./budget_monitor";
import { cancellationManager } from "./cancel_manager";
import { CircuitBreaker } from "./circuit_breaker";
import { DEBUG_CONFIG, HARNESS_CONFIG } from "./constants";
import { ContentSanitizer } from "./content_sanitizer";
import { ContextManager } from "./context_manager";
import { queuePromptDebug } from "./debug";
import { type DegradationLevel, DegradationManager } from "./degradation";
import { HarnessEventEmitter } from "./events";
import { HitlGuard } from "./hitl_guard";
import { LoopDetector } from "./loop_detector";
import { HARNESS_PROMPTS } from "./prompts";
import { RecoveryHandler, type StrategyRef } from "./recovery";
import { AgentStatusTracker } from "./status-tracker";
import { processStreamEvents } from "./stream-processor";
import { ToolExecutor } from "./tool-executor";
import { DEFAULT_HARNESS_TOGGLES, type HarnessConfig, type HarnessEvent, type HarnessRuntimeConfig } from "./types";

interface TurnRuntime {
  isComplete: boolean;
  currentSystemPrompt: string;
  currentToolMap: Map<string, ToolDefinition>;
  lastDegradationLevel: DegradationLevel;
  totalInputTokensSum: number;
  previousThought: string;
}

export class NlahHarness {
  private provider: LLMProvider;
  private strategyRef: StrategyRef;
  private missionId: string;
  private tenantId: string;
  private delegationDepth: number;
  private explicitTools?: ToolDefinition[];
  private restTools: RestToolConfig[] = [];
  private skills?: string[];
  private behaviorPrompt: BehaviorPrompt | null = null;
  private compressionEnabled = true;
  private pacingEnabled = true;
  private pacingForced = false;
  private loopDetectionEnabled = true;
  private harnessConfig?: HarnessRuntimeConfig;
  private statusTracker?: AgentStatusTracker;
  private static toolRetriever: ToolRetriever | null = null;
  private static skillRegistry = new SkillRegistry();

  private featureToggles: HarnessFeatureToggles;
  private loopDetector: LoopDetector;
  private hitlGuard: HitlGuard;
  private contentSanitizer: ContentSanitizer;
  private contextManager: ContextManager;
  private totalCostUsd = 0;

  private emitter: HarnessEventEmitter;
  private toolExecutor: ToolExecutor;
  private recovery: RecoveryHandler;

  constructor(options: HarnessConfig) {
    this.provider = options.provider;
    this.strategyRef = { current: options.strategy };
    this.missionId = options.missionId || crypto.randomUUID();
    this.tenantId = options.tenantId || HARNESS_CONFIG.DEFAULT_TENANT_ID;
    this.delegationDepth = options.delegationDepth ?? 0;
    this.explicitTools = options.tools;
    this.restTools = options.restTools ?? [];
    this.skills = options.skills;
    this.behaviorPrompt = options.behaviorPrompt ?? null;
    this.harnessConfig = options.harnessConfig;
    this.totalCostUsd = options.initialCostUsd ?? 0;

    this.featureToggles = { ...DEFAULT_HARNESS_TOGGLES, ...options.harnessConfig };
    this.loopDetector = new LoopDetector(this.featureToggles.loopDetection);
    this.hitlGuard = new HitlGuard(this.featureToggles.hitlGuard);
    this.contextManager = new ContextManager(this.featureToggles.contextOptimization);
    this.contentSanitizer = new ContentSanitizer();

    this.emitter = new HarnessEventEmitter({
      getMissionId: () => this.missionId,
      getStatusTracker: () => this.statusTracker,
      systemNoticesEnabled: this.featureToggles.systemNotices.enabled,
    });
    this.toolExecutor = new ToolExecutor({
      provider: this.provider,
      delegationDepth: this.delegationDepth,
      harnessConfig: this.harnessConfig,
      getPacingForced: () => this.pacingForced,
      getStatusTracker: () => this.statusTracker,
      emitter: this.emitter,
    });
    this.recovery = new RecoveryHandler({
      provider: this.provider,
      strategyRef: this.strategyRef,
      getCompressionEnabled: () => this.compressionEnabled,
      behaviorPrompt: this.behaviorPrompt,
      emitter: this.emitter,
    });

    if (!NlahHarness.toolRetriever) {
      NlahHarness.toolRetriever = new ToolRetriever();
    }
  }

  public restoreLoopDetectorHistory(history: string[]): void {
    this.loopDetector.restoreHistory(history);
  }

  private async setupMissionParams(traceparent?: string) {
    const traceId = crypto.randomUUID().replace(/-/g, "");
    const parentSpanId = "";
    if (traceparent?.startsWith("00-")) {
      const parts = traceparent.split("-");
      if (parts.length >= 3) {
        return { traceId: parts[1], parentSpanId: parts[2] };
      }
    }
    return { traceId, parentSpanId };
  }

  private selectTools(state: AgentState): { tools: ToolDefinition[]; toolMap: Map<string, ToolDefinition> } {
    const fullToolPool = toolRegistry.getAllTools();
    const depthExceeded = this.delegationDepth >= HARNESS_CONFIG.MAX_DELEGATION_DEPTH;

    let filteredFullPool = fullToolPool;
    if (depthExceeded) {
      filteredFullPool = fullToolPool.filter((t) => t.name !== "delegate_task");
    }

    let tools: ToolDefinition[];
    if (this.explicitTools !== undefined) {
      tools = depthExceeded ? this.explicitTools.filter((t) => t.name !== "delegate_task") : this.explicitTools;
      logger.info(
        `[selectTools] Using explicitTools (length=${this.explicitTools.length}): ${this.explicitTools.map((t) => t.name).join(", ") || "(empty)"}`,
      );
    } else {
      logger.info(
        `[selectTools] No explicitTools set — falling back to ToolRetriever (fullToolPool=${fullToolPool.length} tools)`,
      );
      // Strict allowlist: web_search can only be enabled via explicit features.
      const retrieverPool = filteredFullPool.filter((t) => t.name !== "web_search");
      tools = (NlahHarness.toolRetriever as ToolRetriever).getRelevantTools(state.objective, retrieverPool);
    }

    if (this.skills?.length) {
      const allowed = NlahHarness.skillRegistry.getToolFilter(this.skills);
      if (allowed) tools = tools.filter((t) => allowed.includes(t.name));
      logger.info(
        `[selectTools] Skills filter applied (skills=${this.skills.join(",")}) — tools remaining: ${tools.length}`,
      );
    }

    if (this.behaviorPrompt?.boundTools?.length) {
      const bound = this.behaviorPrompt.boundTools;
      const removed = tools.filter((t) => !bound.includes(t.name));
      tools = applyBoundTools(tools, bound);
      if (removed.length > 0) {
        logger.warn(
          `[selectTools] Bound-tools filter removed (${removed.length}): ${removed.map((t) => t.name).join(", ")}`,
        );
      }
    }

    logger.info(`[selectTools] Final tools (${tools.length}): ${tools.map((t) => t.name).join(", ") || "(none)"}`);
    return { tools, toolMap: new Map(tools.map((t) => [t.name, t])) };
  }

  private buildSystemPrompt(state: AgentState, tools: ToolDefinition[]): string {
    let systemPrompt = this.strategyRef.current.buildSystemPrompt(state, tools, this.behaviorPrompt);
    if (this.skills?.length) {
      const skillPrompts = NlahHarness.skillRegistry.compileSkillPrompts(this.skills);
      const modifiers = NlahHarness.skillRegistry.compileModifiers(this.skills);
      systemPrompt += `\n\n${skillPrompts}`;
      if (modifiers.compression === false) this.compressionEnabled = false;
      if (modifiers.pacing === false) this.pacingEnabled = false;
      if (modifiers.loopDetection === false) this.loopDetectionEnabled = false;
    }
    return systemPrompt;
  }

  private async checkCancellation(iteration: number, onPacket: (p: HarnessEvent) => Promise<void>): Promise<boolean> {
    // isCancelled covers cancels that landed before this mission registered its
    // AbortController (the createMission window), so the run stops before the
    // first LLM call instead of burning tokens.
    if (cancellationManager.isAborted(this.missionId) || cancellationManager.isCancelled(this.missionId)) {
      logger.info(`NlahHarness: Mission ${this.missionId} cancelled, aborting harness run.`);
      await this.emitter.emitMetadata(onPacket, iteration, { content: `Mission execution cancelled.` });
      return true;
    }
    return false;
  }

  private async emitDebugPackets(
    state: AgentState,
    systemPrompt: string,
    iteration: number,
    onPacket: (p: HarnessEvent) => Promise<void>,
  ): Promise<void> {
    if (!ENV.DEBUG_PROMPT && ENV.NODE_ENV !== DEBUG_CONFIG.ENV) return;
    queuePromptDebug({ state, iteration, strategyName: this.strategyRef.current.name, systemPrompt });
    logger.info(`📓 Prompt debug operations queued in background`);
    try {
      await this.emitter.emitDebug(
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

  async runMission(state: AgentState, onPacket: (packet: HarnessEvent) => Promise<void>, traceparent?: string) {
    this.missionId = state.missionId;

    await this.emitter.emitMetadata(onPacket, 0, { content: `Initializing state registry context.` });

    const { traceId } = await this.setupMissionParams(traceparent);
    const trace = startAgentTrace(
      traceId,
      state.missionId,
      this.tenantId,
      this.strategyRef.current.name,
      state.objective,
    );
    const { tools, toolMap } = this.selectTools(state);
    const systemPrompt = this.buildSystemPrompt(state, tools);

    await this.emitter.emitMetadata(onPacket, state.tasks.length, {
      strategy: this.strategyRef.current.name,
      historyDepth: state.messages.length,
      toolsAvailable: tools.map((t) => t.name),
      objective: state.objective,
      maxIterations: HARNESS_CONFIG.MAX_ITERATIONS,
    });

    let iteration = state.tasks.length;
    const maxIterations = HARNESS_CONFIG.MAX_ITERATIONS;

    const cbEnabled = this.harnessConfig?.circuitBreaker?.enabled ?? true;
    const circuit = new CircuitBreaker(
      cbEnabled
        ? {
            openAfter: this.harnessConfig?.circuitBreaker?.openAfter,
            maxRetriesPerTool: this.harnessConfig?.circuitBreaker?.maxRetriesPerTool,
          }
        : { openAfter: Infinity, maxRetriesPerTool: Infinity },
    );

    const degEnabled = this.harnessConfig?.degradation?.enabled ?? true;
    const degradation = new DegradationManager(
      degEnabled
        ? {
            degradeAfter: this.harnessConfig?.degradation?.degradeAfter,
            abortAfter: this.harnessConfig?.degradation?.abortAfter,
          }
        : { degradeAfter: Infinity, abortAfter: Infinity },
    );

    this.statusTracker = new AgentStatusTracker(
      iteration,
      maxIterations,
      this.strategyRef.current.name === "standard" ? "standard" : "agent",
    );
    await this.emitter.updateStatus(onPacket, { state: "running" }, iteration);
    const maxContextTokens = this.provider.maxContextTokens;

    const budgetMonitor = new BudgetMonitor(this.featureToggles.budgetMonitor);

    const runtime: TurnRuntime = {
      isComplete: false,
      currentSystemPrompt: systemPrompt,
      currentToolMap: toolMap,
      lastDegradationLevel: "normal",
      totalInputTokensSum: 0,
      previousThought: "",
    };

    try {
      while (!runtime.isComplete && iteration < maxIterations) {
        if (await this.checkCancellation(iteration, onPacket)) break;
        iteration++;

        let span: LangfuseSpan | null = null;
        if (trace) {
          span = trace.startObservation(
            `turn-${iteration}`,
            {
              input: { messagesCount: state.messages.length },
            },
            { asType: "span" },
          );
        }

        logger.info(`Agent iteration ${iteration}`, {
          missionId: state.missionId,
          traceId: trace?.traceId,
          spanId: span?.id,
        });

        if (span?.otelSpan) {
          await context.with(otelTrace.setSpan(context.active(), span.otelSpan), () =>
            this.runTurn(
              state,
              onPacket,
              iteration,
              trace,
              span,
              circuit,
              degradation,
              budgetMonitor,
              tools,
              maxContextTokens ?? 0,
              runtime,
            ),
          );
        } else {
          await this.runTurn(
            state,
            onPacket,
            iteration,
            trace,
            span,
            circuit,
            degradation,
            budgetMonitor,
            tools,
            maxContextTokens ?? 0,
            runtime,
          );
        }
      }

      if (iteration >= maxIterations) {
        logger.warn(`Max iterations reached`, { missionId: state.missionId });
        await this.emitter.updateStatus(onPacket, { state: "aborted" }, iteration);
      } else if (runtime.isComplete) {
        await this.emitter.updateStatus(onPacket, { state: "completed" }, iteration);
      }

      await this.emitter.emitTurnComplete(onPacket, iteration, runtime.isComplete, iteration, this.totalCostUsd);

      await stateStorage.set(state.missionId, state, HARNESS_CONFIG.STATE_TTL_SECONDS);

      if (ENV.DEBUG_PROMPT || ENV.NODE_ENV === DEBUG_CONFIG.ENV) {
        queuePromptDebug({
          state,
          iteration,
          strategyName: this.strategyRef.current.name,
          systemPrompt,
        });
      }
    } finally {
      // Finalize the trace on every exit path: a mid-turn abort rethrows out of
      // runTurn, so without the finally the trace would stay open in Langfuse.
      if (trace) {
        const cancelled =
          cancellationManager.isCancelled(this.missionId) || cancellationManager.isAborted(this.missionId);
        trace.update({
          output: {
            completed: runtime.isComplete,
            totalIterations: iteration,
            ...(cancelled ? { status: "interrupted" } : {}),
          },
        });
        trace.end();
        logger.info("Langfuse trace ended successfully.");
      }
    }
  }

  private async runTurn(
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
    await langfuseStorage.run({ trace, span, sessionId: state.missionId, userId: this.tenantId }, async () => {
      try {
        if (degradation.shouldAbort()) {
          const errMsg = `ABORT: Execution failed due to ${degradation.getConsecutiveFailures()} consecutive tool errors.`;
          logger.error(errMsg);
          await this.emitter.updateStatus(onPacket, { state: "aborted" }, iteration);
          throw new Error(errMsg);
        }

        const result = await this.recovery.handleDegradation(
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
          this.strategyRef.current.name === "standard"
            ? "standard"
            : currentLevel === "restricted"
              ? "restricted"
              : "agent";
        await this.emitter.updateStatus(
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

        if (this.pacingEnabled && iteration > HARNESS_CONFIG.PACING_THRESHOLD) {
          logger.warn(`Cognitive pacing threshold crossed (iteration: ${iteration}). Injecting forced synthesis.`);
          state.messages.push(new HumanMessage(HARNESS_PROMPTS.PACING_WARNING(iteration)));
          this.pacingForced = true;
          runtime.currentToolMap = new Map();
        }

        // BUDGET CHECK
        const budgetCheck = budgetMonitor.checkBudget(iteration, this.totalCostUsd);
        if (budgetCheck.exceeded) {
          logger.warn(`[NlahHarness] Budget threshold crossed: ${budgetCheck.message}`);
          if (this.featureToggles.systemNotices.enabled && this.featureToggles.systemNotices.emitBudgetWarnings) {
            await this.emitter.emitSystemNotice(
              onPacket,
              iteration,
              "BUDGET_WARNING",
              budgetCheck.message as string,
              "error",
            );
          }
          await this.emitter.updateStatus(onPacket, { state: "aborted" }, iteration);
          if (span) {
            span.update({ output: { status: "budget_aborted", reason: budgetCheck.reason } });
            span.end();
          }
          runtime.isComplete = true;
          return;
        }

        await this.recovery.handleCompaction(state, iteration, onPacket);
        await this.emitDebugPackets(state, runtime.currentSystemPrompt, iteration, onPacket);

        const activeTools = currentLevel !== "normal" ? [] : tools;
        const dynamicEnvContext = `Current Time: ${new Date().toISOString()} | Session: ${state.missionId}`;
        const preparedMessages = this.contextManager.prepareMessagesPayload(
          runtime.currentSystemPrompt,
          dynamicEnvContext,
          state.messages,
        );
        const eventStream = this.provider.stream(
          preparedMessages,
          activeTools,
          runtime.currentSystemPrompt,
          cancellationManager.getSignal(this.missionId),
        );

        const { assistantContent, reasoningContent, pendingToolCall, hasContentEmitted, usage } =
          await processStreamEvents({
            eventStream,
            iteration,
            onPacket,
            emitter: this.emitter,
            provider: this.provider,
            contentSanitizer: this.contentSanitizer,
            statusTracker: this.statusTracker,
            harnessConfig: this.harnessConfig,
          });

        // ACCUMULATE ACTUAL COST
        if (usage) {
          const { stepCost } = calculateUsageCost(
            this.provider.modelName ?? "unknown",
            this.provider.baseURL ?? "",
            usage.promptTokens,
            usage.completionTokens,
            usage.cachedTokens ?? 0,
          );
          this.totalCostUsd += stepCost;
          runtime.totalInputTokensSum += usage.promptTokens;
        }

        // LAYER 2: SEMANTIC LOOP DETECTION (Cosine Similarity) — existing behavior preserved
        if (runtime.previousThought && assistantContent) {
          const sim = getCosineSimilarity(runtime.previousThought, assistantContent);
          logger.info(`Semantic cosine similarity calculated: ${sim.toFixed(4)}`);
          if (this.loopDetectionEnabled && sim >= HARNESS_CONFIG.SIMILARITY_THRESHOLD) {
            logger.langfuse(
              "WARN",
              `Semantic similarity threshold crossed (sim: ${sim.toFixed(4)}). Injecting loop warning.`,
            );
            state.messages.push(new HumanMessage(HARNESS_PROMPTS.REPEATING_WARNING));
            await this.emitter.updateStatus(onPacket, { state: "looping" }, iteration);
          }
        }
        runtime.previousThought = assistantContent;

        let toolCallResult: { name: string; args: Record<string, unknown> } | null = pendingToolCall;

        // LAYER 1: EXACT TOOL CALL LOOP DETECTION (MD5 Hash Ring Buffer)
        if (
          toolCallResult &&
          this.featureToggles.loopDetection.enabled &&
          this.featureToggles.loopDetection.enableExactMatch
        ) {
          const loopResult = this.loopDetector.recordAndCheck(toolCallResult.name, toolCallResult.args);
          if (loopResult.isLoop) {
            logger.warn(`[NlahHarness] Exact tool call loop detected for ${toolCallResult.name}`);
            if (this.featureToggles.systemNotices.enabled && this.featureToggles.systemNotices.emitLoopWarnings) {
              await this.emitter.emitSystemNotice(
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
        if (toolCallResult && this.hitlGuard.isProtected(toolCallResult.name)) {
          logger.info(`[NlahHarness] HITL approval required for protected tool: ${toolCallResult.name}`);
          const approval = this.hitlGuard.createApprovalPayload(this.missionId, state.missionId, {
            id: `tool_${Date.now()}`,
            name: toolCallResult.name,
            args: toolCallResult.args,
          });
          await stateStorage.set(
            `paused:${approval.approvalId}`,
            {
              approvalId: approval.approvalId,
              missionId: this.missionId,
              sessionId: state.missionId,
              pendingToolCall: {
                id: approval.toolCall.id,
                name: approval.toolCall.name,
                args: approval.toolCall.args,
              },
              state,
              harnessSnapshot: {
                strategyName: this.strategyRef.current.name,
                toolNames: Array.from(runtime.currentToolMap.keys()),
                restTools: this.restTools,
                providerConfig: {
                  type: ProviderFactory.resolveType(this.provider) ?? "unknown",
                  base_url: this.provider.baseURL ?? "",
                  api_key: null,
                  model: this.provider.modelName ?? "unknown",
                },
                delegationDepth: this.delegationDepth,
                featureToggles: this.featureToggles,
                behaviorPrompt: this.behaviorPrompt,
              },
              metadata: {
                totalCostUsd: this.totalCostUsd,
                loopDetectorHistory: this.loopDetector.getHistory(),
                pausedAt: new Date().toISOString(),
                expiresAt: approval.expiresAt,
              },
            },
            HARNESS_CONFIG.PAUSED_STATE_TTL_SECONDS,
          );
          await onPacket({
            type: "hitl_approval_required",
            timestamp: Date.now(),
            missionId: this.missionId,
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
          await this.toolExecutor.execute(
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
          await this.emitter.emitContent(onPacket, iteration, assistantContent);
        } else {
          logger.info(
            `[runMission] Iter ${iteration}: no toolCall — entering autoRecovery (contentLen=${assistantContent.length}, hasContentEmitted=${hasContentEmitted})`,
          );
          const { isComplete: turnComplete, retryWithTool } = await this.recovery.handleAutoRecovery(
            assistantContent,
            reasoningContent,
            iteration,
            state,
            runtime.currentToolMap,
          );
          runtime.isComplete = turnComplete;
          if (retryWithTool) {
            await this.toolExecutor.execute(
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
            await this.emitter.emitContent(onPacket, iteration, assistantContent);
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
        if (cancellationManager.isAborted(this.missionId) || cancellationManager.isCancelled(this.missionId)) {
          logger.info(`NlahHarness: Mission ${this.missionId} aborted mid-turn, surfacing as cancellation.`);
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
