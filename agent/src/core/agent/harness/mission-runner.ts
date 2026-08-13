import type { LangfuseSpan } from "@langfuse/tracing";
import { context, trace as otelTrace } from "@opentelemetry/api";
import { ENV } from "../../../config/env";
import type { AgentState, HarnessFeatureToggles, LLMProvider, ToolDefinition } from "../../../shared/types";
import { startAgentTrace } from "../../../shared/utils/langfuse";
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
import { queuePromptDebug } from "./debug";
import { DegradationManager } from "./degradation";
import type { HarnessEventEmitter } from "./events";
import type { StrategyRef } from "./recovery";
import { AgentStatusTracker } from "./status-tracker";
import type { TurnRunner, TurnRuntime } from "./turn-runner";
import type { HarnessEvent, HarnessRuntimeConfig } from "./types";

export interface MissionRunnerDeps {
  provider: LLMProvider;
  strategyRef: StrategyRef;
  emitter: HarnessEventEmitter;
  harnessConfig?: HarnessRuntimeConfig;
  featureToggles: HarnessFeatureToggles;
  tenantId: string;
  explicitTools?: ToolDefinition[];
  skills?: string[];
  delegationDepth: number;
  behaviorPrompt: BehaviorPrompt | null;
  turnRunner: TurnRunner;
  getMissionId: () => string;
  setMissionId: (missionId: string) => void;
  setStatusTracker: (statusTracker: AgentStatusTracker) => void;
  getTotalCostUsd: () => number;
  setCompressionEnabled: (enabled: boolean) => void;
  setPacingEnabled: (enabled: boolean) => void;
  setLoopDetectionEnabled: (enabled: boolean) => void;
}

export class MissionRunner {
  private static toolRetriever: ToolRetriever | null = null;
  private static skillRegistry = new SkillRegistry();

  constructor(private readonly deps: MissionRunnerDeps) {
    if (!MissionRunner.toolRetriever) {
      MissionRunner.toolRetriever = new ToolRetriever();
    }
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
    const depthExceeded = this.deps.delegationDepth >= HARNESS_CONFIG.MAX_DELEGATION_DEPTH;

    let filteredFullPool = fullToolPool;
    if (depthExceeded) {
      filteredFullPool = fullToolPool.filter((t) => t.name !== "delegate_task");
    }

    let tools: ToolDefinition[];
    if (this.deps.explicitTools !== undefined) {
      tools = depthExceeded
        ? this.deps.explicitTools.filter((t) => t.name !== "delegate_task")
        : this.deps.explicitTools;
      logger.info(
        `[selectTools] Using explicitTools (length=${this.deps.explicitTools.length}): ${this.deps.explicitTools.map((t) => t.name).join(", ") || "(empty)"}`,
      );
    } else {
      logger.info(
        `[selectTools] No explicitTools set — falling back to ToolRetriever (fullToolPool=${fullToolPool.length} tools)`,
      );
      // Strict allowlist: web_search can only be enabled via explicit features.
      const retrieverPool = filteredFullPool.filter((t) => t.name !== "web_search");
      tools = (MissionRunner.toolRetriever as ToolRetriever).getRelevantTools(state.objective, retrieverPool);
    }

    if (this.deps.skills?.length) {
      const allowed = MissionRunner.skillRegistry.getToolFilter(this.deps.skills);
      if (allowed) tools = tools.filter((t) => allowed.includes(t.name));
      logger.info(
        `[selectTools] Skills filter applied (skills=${this.deps.skills.join(",")}) — tools remaining: ${tools.length}`,
      );
    }

    if (this.deps.behaviorPrompt?.boundTools?.length) {
      const bound = this.deps.behaviorPrompt.boundTools;
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
    let systemPrompt = this.deps.strategyRef.current.buildSystemPrompt(state, tools, this.deps.behaviorPrompt);
    if (this.deps.skills?.length) {
      const skillPrompts = MissionRunner.skillRegistry.compileSkillPrompts(this.deps.skills);
      const modifiers = MissionRunner.skillRegistry.compileModifiers(this.deps.skills);
      systemPrompt += `\n\n${skillPrompts}`;
      if (modifiers.compression === false) this.deps.setCompressionEnabled(false);
      if (modifiers.pacing === false) this.deps.setPacingEnabled(false);
      if (modifiers.loopDetection === false) this.deps.setLoopDetectionEnabled(false);
    }
    return systemPrompt;
  }

  private async checkCancellation(iteration: number, onPacket: (p: HarnessEvent) => Promise<void>): Promise<boolean> {
    // isCancelled covers cancels that landed before this mission registered its
    // AbortController (the createMission window), so the run stops before the
    // first LLM call instead of burning tokens.
    if (
      cancellationManager.isAborted(this.deps.getMissionId()) ||
      cancellationManager.isCancelled(this.deps.getMissionId())
    ) {
      logger.info(`NlahHarness: Mission ${this.deps.getMissionId()} cancelled, aborting harness run.`);
      await this.deps.emitter.emitMetadata(onPacket, iteration, { content: `Mission execution cancelled.` });
      return true;
    }
    return false;
  }

  async runMission(state: AgentState, onPacket: (packet: HarnessEvent) => Promise<void>, traceparent?: string) {
    this.deps.setMissionId(state.missionId);

    await this.deps.emitter.emitMetadata(onPacket, 0, { content: `Initializing state registry context.` });

    const { traceId } = await this.setupMissionParams(traceparent);
    const trace = startAgentTrace(
      traceId,
      state.missionId,
      this.deps.tenantId,
      this.deps.strategyRef.current.name,
      state.objective,
    );
    const { tools, toolMap } = this.selectTools(state);
    const systemPrompt = this.buildSystemPrompt(state, tools);

    await this.deps.emitter.emitMetadata(onPacket, state.tasks.length, {
      strategy: this.deps.strategyRef.current.name,
      historyDepth: state.messages.length,
      toolsAvailable: tools.map((t) => t.name),
      objective: state.objective,
      maxIterations: HARNESS_CONFIG.MAX_ITERATIONS,
    });

    let iteration = state.tasks.length;
    const maxIterations = HARNESS_CONFIG.MAX_ITERATIONS;

    const cbEnabled = this.deps.harnessConfig?.circuitBreaker?.enabled ?? true;
    const circuit = new CircuitBreaker(
      cbEnabled
        ? {
            openAfter: this.deps.harnessConfig?.circuitBreaker?.openAfter,
            maxRetriesPerTool: this.deps.harnessConfig?.circuitBreaker?.maxRetriesPerTool,
          }
        : { openAfter: Infinity, maxRetriesPerTool: Infinity },
    );

    const degEnabled = this.deps.harnessConfig?.degradation?.enabled ?? true;
    const degradation = new DegradationManager(
      degEnabled
        ? {
            degradeAfter: this.deps.harnessConfig?.degradation?.degradeAfter,
            abortAfter: this.deps.harnessConfig?.degradation?.abortAfter,
          }
        : { degradeAfter: Infinity, abortAfter: Infinity },
    );

    this.deps.setStatusTracker(
      new AgentStatusTracker(
        iteration,
        maxIterations,
        this.deps.strategyRef.current.name === "standard" ? "standard" : "agent",
      ),
    );
    await this.deps.emitter.updateStatus(onPacket, { state: "running" }, iteration);
    const maxContextTokens = this.deps.provider.maxContextTokens;

    const budgetMonitor = new BudgetMonitor(this.deps.featureToggles.budgetMonitor);

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
            this.deps.turnRunner.runTurn(
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
          await this.deps.turnRunner.runTurn(
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
        await this.deps.emitter.updateStatus(onPacket, { state: "aborted" }, iteration);
      } else if (runtime.isComplete) {
        await this.deps.emitter.updateStatus(onPacket, { state: "completed" }, iteration);
      }

      await this.deps.emitter.emitTurnComplete(
        onPacket,
        iteration,
        runtime.isComplete,
        iteration,
        this.deps.getTotalCostUsd(),
      );

      await stateStorage.set(state.missionId, state, HARNESS_CONFIG.STATE_TTL_SECONDS);

      if (ENV.DEBUG_PROMPT || ENV.NODE_ENV === DEBUG_CONFIG.ENV) {
        queuePromptDebug({
          state,
          iteration,
          strategyName: this.deps.strategyRef.current.name,
          systemPrompt,
        });
      }
    } finally {
      // Finalize the trace on every exit path: a mid-turn abort rethrows out of
      // runTurn, so without the finally the trace would stay open in Langfuse.
      if (trace) {
        const cancelled =
          cancellationManager.isCancelled(this.deps.getMissionId()) ||
          cancellationManager.isAborted(this.deps.getMissionId());
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
}
