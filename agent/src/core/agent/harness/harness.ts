import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { LangfuseSpan } from "@langfuse/tracing";
import { context, trace as otelTrace } from "@opentelemetry/api";
import { ENV } from "../../../config/env";
import { calculateUsageCost } from "../../../infrastructure/providers/utils";
import type { RestToolConfig } from "../../../infrastructure/transports/rest/types";
import type {
  AgentState,
  AgentStatus,
  AgentStrategy,
  HarnessFeatureToggles,
  LLMProvider,
  Observation,
  ProviderEvent,
  Task,
  ToolDefinition,
} from "../../../shared/types";
import { getCosineSimilarity, getHistoryTokens, selectiveTruncateToolResults } from "../../../shared/utils/harness";
import { langfuseStorage, startAgentTrace } from "../../../shared/utils/langfuse";
import { logger } from "../../../shared/utils/logger";
import type { BehaviorPrompt } from "../prompts";
import { applyBoundTools } from "../prompts/bound_tools";
import { ToolRetriever } from "../services/retriever";
import { SkillRegistry } from "../skills";
import { stateStorage } from "../storage/factory";
import { StrategyFactory } from "../strategies/factory";
import { toolRegistry } from "../tools/registry";
import { BudgetMonitor } from "./budget_monitor";
import { cancellationManager } from "./cancel_manager";
import { CircuitBreaker } from "./circuit_breaker";
import { compressObservation } from "./compressor";
import { DEBUG_CONFIG, HARNESS_CONFIG, OPERATION_STATUS } from "./constants";
import { ContentSanitizer } from "./content_sanitizer";
import { ContextManager } from "./context_manager";
import { queuePromptDebug } from "./debug";
import { type DegradationLevel, DegradationManager } from "./degradation";
import { HitlGuard } from "./hitl_guard";
import { LoopDetector } from "./loop_detector";
import { HARNESS_PROMPTS } from "./prompts";
import { AgentStatusTracker } from "./status-tracker";
import { isFakeToolTrace } from "./trace-guard";
import { DEFAULT_HARNESS_TOGGLES, type HarnessConfig, type HarnessEvent, type HarnessRuntimeConfig } from "./types";
import { hasProtocolMarkup, parseXmlToolCall } from "./xml_tool_parser";

export class NlahHarness {
  private provider: LLMProvider;
  private strategy: AgentStrategy;
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
  private lastActivityAt = Date.now();
  private stallEmitted = false;

  constructor(options: HarnessConfig) {
    this.provider = options.provider;
    this.strategy = options.strategy;
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

    if (!NlahHarness.toolRetriever) {
      NlahHarness.toolRetriever = new ToolRetriever();
    }
  }

  public restoreLoopDetectorHistory(history: string[]): void {
    this.loopDetector.restoreHistory(history);
  }

  private async emitSystemNotice(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    code: string,
    message: string,
    level: "info" | "warning" | "error" = "warning",
  ) {
    if (this.featureToggles.systemNotices.enabled) {
      await this.sendBase(onPacket, { type: "system_notice", step, payload: { level, code, message } });
    }
  }

  private async sendBase(
    onPacket: (p: HarnessEvent) => Promise<void>,
    packet: { type: string } & Record<string, unknown>,
  ) {
    if (packet.type !== "heartbeat") {
      this.lastActivityAt = Date.now();
      this.stallEmitted = false;
    }
    const agentStatus = this.statusTracker?.getStatus();
    await onPacket({
      missionId: this.missionId,
      ...packet,
      ...(agentStatus ? { agentStatus } : {}),
    });
  }

  private async emitMetadata(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    fields: {
      content?: string;
      strategy?: string;
      historyDepth?: number;
      toolsAvailable?: string[];
      objective?: string;
      maxIterations?: number;
      title?: string;
      summary?: string;
    },
  ) {
    await this.sendBase(onPacket, { type: "metadata", step, ...fields });
  }

  private async emitStateChange(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    from: string,
    to: string,
    reason: string,
  ) {
    await this.sendBase(onPacket, { type: "state_change", step, from, to, reason });
  }

  private async emitDegraded(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    from: string,
    to: string,
    reason: string,
  ) {
    await this.sendBase(onPacket, { type: "degraded", step, from, to, reason });
  }

  private async emitReasoning(onPacket: (p: HarnessEvent) => Promise<void>, step: number, content: string) {
    await this.sendBase(onPacket, { type: "reasoning", step, content });
  }

  private async emitContent(onPacket: (p: HarnessEvent) => Promise<void>, step: number, content: string) {
    await this.sendBase(onPacket, { type: "content", step, content });
  }

  private async emitUsage(onPacket: (p: HarnessEvent) => Promise<void>, step: number, usage: object) {
    await this.sendBase(onPacket, { type: "usage", step, usage });
  }

  private async emitToolCall(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    toolName: string,
    toolInput: Record<string, unknown>,
  ) {
    await this.sendBase(onPacket, { type: "tool_call", step, toolName, toolInput });
  }

  private async emitToolResult(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    toolName: string,
    content: string,
    toolResult?: unknown,
  ) {
    await this.sendBase(onPacket, { type: "tool_result", step, toolName, content, toolResult });
  }

  private async emitToolSkip(onPacket: (p: HarnessEvent) => Promise<void>, step: number, toolName: string) {
    await this.sendBase(onPacket, { type: "tool_skip", step, toolName });
  }

  private async emitTodos(onPacket: (p: HarnessEvent) => Promise<void>, step: number, todos: unknown) {
    await this.sendBase(onPacket, { type: "todo", step, todos });
  }

  private async emitSubagentCall(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    name: string,
    instruction: string,
  ) {
    await this.sendBase(onPacket, { type: "subagent_call", step, subagent: { name, instruction, status: "calling" } });
  }

  private async emitSubagentResult(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    name: string,
    instruction: string,
    result: string,
    status: "completed" | "failed",
  ) {
    await this.sendBase(onPacket, { type: "subagent_result", step, subagent: { name, instruction, result, status } });
  }

  private async emitProgress(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    phase: string,
    tokensUsed: number,
    tokensTotal: number,
  ) {
    await this.sendBase(onPacket, { type: "progress", step, phase, tokensUsed, tokensTotal });
  }

  private async emitHeartbeat(onPacket: (p: HarnessEvent) => Promise<void>, step: number) {
    await this.sendBase(onPacket, { type: "heartbeat", step });
  }

  private async emitTurnComplete(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    completed: boolean,
    totalIterations: number,
    totalCost: number,
  ) {
    await this.sendBase(onPacket, { type: "turn_complete", step, completed, totalIterations, totalCost });
  }

  private async markStalledIfNeeded(onPacket: (p: HarnessEvent) => Promise<void>, iteration: number): Promise<void> {
    if (this.stallEmitted || !this.statusTracker) return;
    const { changed, from, to } = this.statusTracker.markStalled();
    if (!changed) return;
    this.stallEmitted = true;
    await this.emitStateChange(onPacket, iteration, from, to, "stalled");
  }

  private async emitDebug(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    rawSystemPrompt: string,
    currentHistoryLength: number,
    rawMessages: Array<{ role: string; content: string }>,
  ) {
    await this.sendBase(onPacket, { type: "debug", step, rawSystemPrompt, currentHistoryLength, rawMessages });
  }

  private async updateStatus(
    onPacket: (p: HarnessEvent) => Promise<void>,
    updates: Partial<AgentStatus>,
    step: number,
  ) {
    if (!this.statusTracker) return;
    const { changed, from, to } = this.statusTracker.update(updates);
    if (changed) {
      let reason = "transition";
      if (to === "degraded") {
        reason = "consecutive_tool_failures";
      } else if (to === "looping") {
        reason = "cosine_similarity_threshold";
      }
      await this.emitStateChange(onPacket, step, from, to, reason);
    }
  }

  private async checkStuckState(objective: string, assistantContent: string): Promise<boolean> {
    try {
      const systemPrompt = HARNESS_PROMPTS.STUCK_CLASSIFIER_SYSTEM;
      const userPrompt = HARNESS_PROMPTS.STUCK_CLASSIFIER_USER(objective, assistantContent);

      const checkStream = this.provider.stream([new HumanMessage(userPrompt)], [], systemPrompt);

      let result = "";
      for await (const ev of checkStream) {
        if (ev.content) {
          result += ev.content;
        }
      }

      const parsed = result.trim().toUpperCase();
      logger.info(`[NLAH RECOVER] Dynamic stuck check result: ${parsed}`);
      return parsed.includes("STUCK");
    } catch (err) {
      logger.error("Failed to perform dynamic stuck check", err);
      return false;
    }
  }

  private async setupMissionParams(_state: AgentState, traceparent?: string) {
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
        `[selectTools] No explicitTools set â€” falling back to ToolRetriever (fullToolPool=${fullToolPool.length} tools)`,
      );
      // Strict allowlist: web_search can only be enabled via explicit features.
      const retrieverPool = filteredFullPool.filter((t) => t.name !== "web_search");
      tools = (NlahHarness.toolRetriever as ToolRetriever).getRelevantTools(state.objective, retrieverPool);
    }

    if (this.skills?.length) {
      const allowed = NlahHarness.skillRegistry.getToolFilter(this.skills);
      if (allowed) tools = tools.filter((t) => allowed.includes(t.name));
      logger.info(
        `[selectTools] Skills filter applied (skills=${this.skills.join(",")}) â€” tools remaining: ${tools.length}`,
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
    let systemPrompt = this.strategy.buildSystemPrompt(state, tools, this.behaviorPrompt);
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
    if (cancellationManager.isAborted(this.missionId)) {
      logger.info(`NlahHarness: Mission ${this.missionId} cancelled, aborting harness run.`);
      await this.emitMetadata(onPacket, iteration, { content: `Mission execution cancelled.` });
      return true;
    }
    return false;
  }

  private async handleDegradation(
    state: AgentState,
    degradation: DegradationManager,
    lastDegradationLevel: DegradationLevel,
    iteration: number,
    onPacket: (p: HarnessEvent) => Promise<void>,
  ): Promise<{ systemPrompt: string; toolMap: Map<string, ToolDefinition>; lastDegradationLevel: DegradationLevel }> {
    const currentLevel = degradation.getLevel();
    if (currentLevel === lastDegradationLevel) {
      return { systemPrompt: "", toolMap: new Map(), lastDegradationLevel };
    }

    const fromStr = lastDegradationLevel === "normal" ? "nlah" : "restricted";
    const toStr = currentLevel === "restricted" ? "restricted" : "standard";
    const reasonStr = currentLevel === "restricted" ? "circuit_breakers_open" : "consecutive_tool_failures";

    await this.emitDegraded(onPacket, iteration, fromStr, toStr, reasonStr);

    let systemPrompt = "";
    const toolMap = new Map<string, ToolDefinition>();

    if (currentLevel === "restricted") {
      state.messages.push(new HumanMessage("System: tool execution errors detected. Continuing with knowledge only."));
      systemPrompt = this.strategy.buildSystemPrompt(state, [], this.behaviorPrompt);
    } else if (currentLevel === "standard") {
      state.messages.push(new HumanMessage("System: switching to direct response."));
      this.strategy = StrategyFactory.create("standard");
      const anchor = state.messages[0];
      const lastUserMsg = [...state.messages].reverse().find((m) => m._getType() === "human");
      state.messages = lastUserMsg ? [anchor, lastUserMsg] : [anchor];
      systemPrompt = this.strategy.buildSystemPrompt(state, [], this.behaviorPrompt);
    }

    return { systemPrompt, toolMap, lastDegradationLevel: currentLevel };
  }

  private async handleCompaction(
    state: AgentState,
    iteration: number,
    onPacket: (p: HarnessEvent) => Promise<void>,
  ): Promise<void> {
    if (!this.compressionEnabled || !this.provider.maxContextTokens) return;
    const maxContextTokens = this.provider.maxContextTokens;
    const currentTokens = getHistoryTokens(state.messages);
    const tokenUsageRatio = currentTokens / maxContextTokens;
    if (tokenUsageRatio <= HARNESS_CONFIG.COMPACTION_RATIO) return;

    logger.info(`Compacting conversation context due to high token ratio (${(tokenUsageRatio * 100).toFixed(1)}%)`);
    try {
      const keepCount = HARNESS_CONFIG.KEEP_LAST_TURNS * 2;
      const totalMsgs = state.messages.length;
      const anchor = state.messages[0];
      const cutIndex = Math.max(1, totalMsgs - keepCount);
      const msgsToCompact = state.messages.slice(1, cutIndex);
      const lastTurns = state.messages.slice(cutIndex);
      const droppedLastTurns = selectiveTruncateToolResults(lastTurns, HARNESS_CONFIG.DROP_TOOL_IF_LONGER);

      let summaryText = "";
      if (msgsToCompact.length > 0) {
        const compactEventStream = this.provider.stream(
          [anchor, ...msgsToCompact, new HumanMessage(HARNESS_PROMPTS.COMPACTION_PROMPT)],
          [],
          HARNESS_PROMPTS.COMPACTION_SYSTEM,
        );
        for await (const ev of compactEventStream) {
          if (ev.content) summaryText += ev.content;
        }
        await this.provider.cleanupReasoning?.();
      }

      const summaryMsg = summaryText
        ? [new AIMessage(HARNESS_PROMPTS.COMPACTION_SUMMARY_WRAPPER(iteration, summaryText))]
        : [];
      state.messages = [anchor, ...summaryMsg, ...droppedLastTurns];

      logger.info("Context compaction successfully applied.");
      await this.emitReasoning(onPacket, iteration, HARNESS_PROMPTS.LOG_COMPACTED(getHistoryTokens(state.messages)));
    } catch (err: unknown) {
      const compactionError = err as { message?: string };
      logger.langfuse("ERROR", `Context compaction failed: ${compactionError.message}`, {
        error: compactionError.message,
      });
    }
  }

  private async emitDebugPackets(
    state: AgentState,
    systemPrompt: string,
    iteration: number,
    onPacket: (p: HarnessEvent) => Promise<void>,
  ): Promise<void> {
    if (!ENV.DEBUG_PROMPT && ENV.NODE_ENV !== DEBUG_CONFIG.ENV) return;
    queuePromptDebug({ state, iteration, strategyName: this.strategy.name, systemPrompt });
    logger.info(`ðŸ“ Prompt debug operations queued in background`);
    try {
      await this.emitDebug(
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

  private async processStreamEvents(
    eventStream: AsyncIterable<ProviderEvent>,
    iteration: number,
    onPacket: (p: HarnessEvent) => Promise<void>,
  ): Promise<{
    assistantContent: string;
    reasoningContent: string;
    pendingToolCall: { name: string; args: Record<string, unknown> } | null;
    hasContentEmitted: boolean;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number; cachedTokens?: number } | null;
  }> {
    let assistantContent = "";
    let reasoningContent = "";
    let pendingToolCall: { name: string; args: Record<string, unknown> } | null = null;
    let hasContentEmitted = false;
    let usageResult: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cachedTokens?: number;
    } | null = null;
    let tokenEstimate = 0;
    const streamStart = Date.now();
    let lastChunkTime = Date.now();
    const heartbeatIntervalTime =
      this.harnessConfig?.agentStatus?.heartbeatInterval ?? HARNESS_CONFIG.AGENT_STATUS.HEARTBEAT_INTERVAL;
    const stallTimeout = this.harnessConfig?.agentStatus?.stallTimeout ?? HARNESS_CONFIG.AGENT_STATUS.STALL_TIMEOUT;

    const heartbeatInterval = setInterval(() => {
      if (Date.now() - this.lastActivityAt > stallTimeout) {
        this.markStalledIfNeeded(onPacket, iteration).catch(() => {});
      }
      if (Date.now() - lastChunkTime >= heartbeatIntervalTime) {
        this.emitHeartbeat(onPacket, iteration).catch(() => {});
      }
    }, heartbeatIntervalTime);

    try {
      for await (const event of eventStream) {
        lastChunkTime = Date.now();

        if (event.reasoning) {
          reasoningContent += event.reasoning;
          tokenEstimate += Math.ceil(event.reasoning.length / 4);
          this.statusTracker?.update({
            currentThought: (reasoningContent || assistantContent).substring(0, 50),
            throughput:
              (Date.now() - streamStart) / 1000 > 0 ? tokenEstimate / ((Date.now() - streamStart) / 1000) : undefined,
          });
          await this.emitReasoning(onPacket, iteration, event.reasoning);
        }
        if (event.content) {
          assistantContent += event.content;
          tokenEstimate += Math.ceil(event.content.length / 4);
          this.statusTracker?.update({
            currentThought: (reasoningContent || assistantContent).substring(0, 50),
            throughput:
              (Date.now() - streamStart) / 1000 > 0 ? tokenEstimate / ((Date.now() - streamStart) / 1000) : undefined,
          });
        }
        if (event.toolCall) {
          logger.info(`[processStreamEvents] Got toolCall event: ${JSON.stringify(event.toolCall)}`);
          pendingToolCall = event.toolCall;
        }
        if (event.content && !pendingToolCall) {
          hasContentEmitted = true;
          const cleanContent = this.contentSanitizer.sanitize(event.content);
          if (cleanContent) {
            await this.emitContent(onPacket, iteration, cleanContent);
          }
        } else if (event.content && pendingToolCall) {
          logger.info(
            `[processStreamEvents] Content suppressed â€” toolCall pending, content_len=${event.content.length}`,
          );
        }
        if (event.usage) {
          const { stepCost } = calculateUsageCost(
            this.provider.modelName ?? "unknown",
            this.provider.baseURL ?? "",
            event.usage.promptTokens,
            event.usage.completionTokens,
            event.usage.cachedTokens ?? 0,
          );
          const enrichedUsage = {
            ...event.usage,
            estimatedCostUsd: stepCost,
            maxContextTokens: this.provider.maxContextTokens,
          };
          await this.emitUsage(onPacket, iteration, enrichedUsage);
          usageResult = {
            promptTokens: event.usage.promptTokens,
            completionTokens: event.usage.completionTokens,
            totalTokens: event.usage.totalTokens,
            cachedTokens: event.usage.cachedTokens,
          };
          const elapsed = (Date.now() - streamStart) / 1000;
          this.statusTracker?.update({
            throughput: elapsed > 0 ? (event.usage.completionTokens ?? 0) / elapsed : undefined,
          });
        }
      }
    } finally {
      clearInterval(heartbeatInterval);
    }

    const flushedContent = this.contentSanitizer.flush();
    if (flushedContent) {
      hasContentEmitted = true;
      await this.emitContent(onPacket, iteration, flushedContent);
    }

    logger.info(
      `[processStreamEvents] Done â€” hasToolCall=${!!pendingToolCall}, contentLen=${assistantContent.length}, reasoningLen=${reasoningContent.length}, hasContentEmitted=${hasContentEmitted}`,
    );
    return { assistantContent, reasoningContent, pendingToolCall, hasContentEmitted, usage: usageResult };
  }

  private async executeToolCall(
    pendingToolCall: { name: string; args: Record<string, unknown> },
    toolMap: Map<string, ToolDefinition>,
    assistantContent: string,
    reasoningContent: string,
    iteration: number,
    onPacket: (p: HarnessEvent) => Promise<void>,
    state: AgentState,
    circuit: CircuitBreaker,
    degradation: DegradationManager,
    totalInputTokensSum: number,
    maxContextTokens: number,
  ): Promise<{ isComplete: boolean }> {
    if (circuit.isOpen(pendingToolCall.name)) {
      logger.warn(`Circuit breaker is open for tool: ${pendingToolCall.name}, skipping execution.`, {
        missionId: state.missionId,
      });
      await this.emitToolSkip(onPacket, iteration, pendingToolCall.name);
      degradation.recordToolError();
      state.messages.push(
        new AIMessage(
          `Tool ${pendingToolCall.name} is currently unavailable due to repeated failures. It has been skipped.`,
        ),
      );
      return { isComplete: false };
    }

    const tool = toolMap.get(pendingToolCall.name);
    if (!tool) {
      const reason = this.pacingForced ? "pacing forced synthesis" : "tool not in map";
      logger.warn(`Tool not found: ${pendingToolCall.name} (${reason})`, { missionId: state.missionId });
      state.messages.push(
        new AIMessage({
          content: assistantContent,
          additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined,
        }),
      );
      return { isComplete: false };
    }

    logger.info(`Executing tool: ${pendingToolCall.name}`, { missionId: state.missionId });
    this.statusTracker?.update({ currentTool: pendingToolCall.name });

    await this.emitToolCall(onPacket, iteration, pendingToolCall.name, pendingToolCall.args);

    if (pendingToolCall.name === "write_todos") {
      await this.emitTodos(onPacket, iteration, pendingToolCall.args.todos);
      state.tasks = pendingToolCall.args.todos as Task[];
    } else if (pendingToolCall.name === "delegate_task") {
      await this.emitSubagentCall(
        onPacket,
        iteration,
        pendingToolCall.args.agentName as string,
        pendingToolCall.args.instruction as string,
      );
    }

    let observation: Observation;
    try {
      observation = await tool.execute(pendingToolCall.args, {
        parentMessages: state.messages,
        onPacket,
        provider: this.provider,
        tools: [...toolMap.values()],
        delegationDepth: this.delegationDepth,
        missionId: state.missionId,
      });
    } catch (err: unknown) {
      const toolError = err as { message?: string };
      logger.error(`Tool execution failed for ${pendingToolCall.name}: ${toolError.message}`, err);
      observation = {
        status: OPERATION_STATUS.ERROR,
        summary: `Tool execution failed: Failed to perform ${pendingToolCall.name}. Please try again later or refine the request.`,
        error: "TOOL_EXECUTION_FAILED",
      };
    }

    const isError = observation.status === OPERATION_STATUS.ERROR;
    if (isError) {
      circuit.recordFailure(pendingToolCall.name);
      degradation.recordToolError();
      const failures = circuit.getState(pendingToolCall.name)?.failures ?? 1;
      const maxRetries =
        this.harnessConfig?.circuitBreaker?.maxRetriesPerTool ?? HARNESS_CONFIG.CIRCUIT_BREAKER.MAX_RETRIES_PER_TOOL;
      const isOpen = circuit.isOpen(pendingToolCall.name);
      observation = compressObservation(observation, failures, maxRetries, isOpen);
    } else {
      circuit.recordSuccess(pendingToolCall.name);
      degradation.reset();
    }

    if (pendingToolCall.name === "delegate_task") {
      await this.emitSubagentResult(
        onPacket,
        iteration,
        pendingToolCall.args.agentName as string,
        pendingToolCall.args.instruction as string,
        observation.summary,
        observation.status === "success" ? "completed" : "failed",
      );
    }

    const toolCallId = `tool_${Date.now()}`;
    state.messages.push(
      new AIMessage({
        content: assistantContent,
        tool_calls: [{ id: toolCallId, name: pendingToolCall.name, args: pendingToolCall.args, type: "tool_call" }],
        additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined,
      }),
    );
    state.messages.push(new ToolMessage({ tool_call_id: toolCallId, content: observation.summary }));

    await this.emitToolResult(onPacket, iteration, pendingToolCall.name, observation.summary, observation.data);

    await this.emitProgress(onPacket, iteration, "tool_execution", totalInputTokensSum, maxContextTokens);
    this.statusTracker?.update({ currentTool: undefined });

    return { isComplete: false };
  }

  private async handleAutoRecovery(
    assistantContent: string,
    reasoningContent: string,
    iteration: number,
    _onPacket: (p: HarnessEvent) => Promise<void>,
    state: AgentState,
    toolMap: Map<string, ToolDefinition>,
  ): Promise<{ isComplete: boolean; retryWithTool: { name: string; args: Record<string, unknown> } | null }> {
    const parsedTool = parseXmlToolCall(assistantContent, new Set(toolMap.keys()));
    if (parsedTool) {
      logger.warn(`[NLAH RECOVER] Soft Recovery triggered. Parsing raw XML tool syntax.`);
      logger.info(`[NLAH RECOVER] Successfully extracted tool: ${parsedTool.name}. Retrying loop.`);
      state.messages.push(
        new AIMessage({
          content: assistantContent,
          additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined,
        }),
      );
      state.messages.push(
        new ToolMessage({ tool_call_id: `fallback_${Date.now()}`, content: HARNESS_PROMPTS.LOG_RE_ROUTE }),
      );
      return { isComplete: false, retryWithTool: parsedTool };
    }

    if (hasProtocolMarkup(assistantContent, new Set(toolMap.keys()))) {
      logger.error(`[NLAH RECOVER] XML detected but unparseable. Escalating to Tier 2.`);
      state.messages.push(new HumanMessage(HARNESS_PROMPTS.RECOVERY_PROMPT));
      return { isComplete: false, retryWithTool: null };
    }

    const looksLikeThinking = await this.checkStuckState(state.objective, assistantContent);
    if (looksLikeThinking && iteration < HARNESS_CONFIG.MAX_ITERATIONS) {
      logger.warn(`[NLAH RECOVER] Tier 2 Feedback Recovery triggered. Agent halted in thinking state.`);
      state.messages.push(
        new AIMessage({
          content: assistantContent,
          additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined,
        }),
      );
      state.messages.push(new HumanMessage(HARNESS_PROMPTS.FEEDBACK_PROMPT));
      return { isComplete: false, retryWithTool: null };
    }

    if (isFakeToolTrace(assistantContent) && iteration < HARNESS_CONFIG.MAX_ITERATIONS) {
      logger.warn(`[NLAH RECOVER] Fake tool trace detected in assistant content. Re-prompting the model.`);
      state.messages.push(
        new AIMessage({
          content: assistantContent,
          additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined,
        }),
      );
      state.messages.push(new HumanMessage(HARNESS_PROMPTS.FAKE_TRACE_FEEDBACK));
      return { isComplete: false, retryWithTool: null };
    }

    state.messages.push(
      new AIMessage({
        content: assistantContent,
        additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined,
      }),
    );
    return { isComplete: true, retryWithTool: null };
  }

  async runMission(state: AgentState, onPacket: (packet: HarnessEvent) => Promise<void>, traceparent?: string) {
    this.missionId = state.missionId;

    await this.emitMetadata(onPacket, 0, { content: `Initializing state registry context.` });

    const { traceId } = await this.setupMissionParams(state, traceparent);
    const trace = startAgentTrace(traceId, state.missionId, this.tenantId, this.strategy.name, state.objective);
    const { tools, toolMap } = this.selectTools(state);
    const systemPrompt = this.buildSystemPrompt(state, tools);

    await this.emitMetadata(onPacket, state.tasks.length, {
      strategy: this.strategy.name,
      historyDepth: state.messages.length,
      toolsAvailable: tools.map((t) => t.name),
      objective: state.objective,
      maxIterations: HARNESS_CONFIG.MAX_ITERATIONS,
    });

    let isComplete = false;
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

    let lastDegradationLevel: DegradationLevel = "normal";
    let currentSystemPrompt = systemPrompt;
    let currentToolMap = toolMap;

    this.statusTracker = new AgentStatusTracker(
      iteration,
      maxIterations,
      this.strategy.name === "standard" ? "standard" : "agent",
    );
    await this.updateStatus(onPacket, { state: "running" }, iteration);
    const maxContextTokens = this.provider.maxContextTokens;

    const budgetMonitor = new BudgetMonitor(this.featureToggles.budgetMonitor);
    let totalInputTokensSum = 0;
    let previousThought = "";

    while (!isComplete && iteration < maxIterations) {
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

      const executeTurn = async () => {
        await langfuseStorage.run({ trace, span, sessionId: state.missionId, userId: this.tenantId }, async () => {
          try {
            if (degradation.shouldAbort()) {
              const errMsg = `ABORT: Execution failed due to ${degradation.getConsecutiveFailures()} consecutive tool errors.`;
              logger.error(errMsg);
              await this.updateStatus(onPacket, { state: "aborted" }, iteration);
              throw new Error(errMsg);
            }

            const result = await this.handleDegradation(state, degradation, lastDegradationLevel, iteration, onPacket);
            if (result.systemPrompt) currentSystemPrompt = result.systemPrompt;
            if (result.toolMap.size > 0 || result.lastDegradationLevel !== lastDegradationLevel)
              currentToolMap = result.toolMap;
            lastDegradationLevel = result.lastDegradationLevel;

            const currentLevel = degradation.getLevel();
            const activeCircuitBreakers = circuit.getAllOpenCircuits();
            const currentStrategyStr =
              this.strategy.name === "standard" ? "standard" : currentLevel === "restricted" ? "restricted" : "agent";
            await this.updateStatus(
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
              currentToolMap = new Map();
            }

            // BUDGET CHECK
            const budgetCheck = budgetMonitor.checkBudget(iteration, this.totalCostUsd);
            if (budgetCheck.exceeded) {
              logger.warn(`[NlahHarness] Budget threshold crossed: ${budgetCheck.message}`);
              if (this.featureToggles.systemNotices.enabled && this.featureToggles.systemNotices.emitBudgetWarnings) {
                await this.emitSystemNotice(
                  onPacket,
                  iteration,
                  "BUDGET_WARNING",
                  budgetCheck.message as string,
                  "error",
                );
              }
              await this.updateStatus(onPacket, { state: "aborted" }, iteration);
              if (span) {
                span.update({ output: { status: "budget_aborted", reason: budgetCheck.reason } });
                span.end();
              }
              isComplete = true;
              return;
            }

            await this.handleCompaction(state, iteration, onPacket);
            await this.emitDebugPackets(state, currentSystemPrompt, iteration, onPacket);

            const activeTools = currentLevel !== "normal" ? [] : tools;
            const dynamicEnvContext = `Current Time: ${new Date().toISOString()} | Session: ${state.missionId}`;
            const preparedMessages = this.contextManager.prepareMessagesPayload(
              currentSystemPrompt,
              dynamicEnvContext,
              state.messages,
            );
            const eventStream = this.provider.stream(preparedMessages, activeTools, currentSystemPrompt);

            const { assistantContent, reasoningContent, pendingToolCall, hasContentEmitted, usage } =
              await this.processStreamEvents(eventStream, iteration, onPacket);

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
              totalInputTokensSum += usage.promptTokens;
            }

            // LAYER 2: SEMANTIC LOOP DETECTION (Cosine Similarity) â€” existing behavior preserved
            if (previousThought && assistantContent) {
              const sim = getCosineSimilarity(previousThought, assistantContent);
              logger.info(`Semantic cosine similarity calculated: ${sim.toFixed(4)}`);
              if (this.loopDetectionEnabled && sim >= HARNESS_CONFIG.SIMILARITY_THRESHOLD) {
                logger.langfuse(
                  "WARN",
                  `Semantic similarity threshold crossed (sim: ${sim.toFixed(4)}). Injecting loop warning.`,
                );
                state.messages.push(new HumanMessage(HARNESS_PROMPTS.REPEATING_WARNING));
                await this.updateStatus(onPacket, { state: "looping" }, iteration);
              }
            }
            previousThought = assistantContent;

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
                  await this.emitSystemNotice(
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
                    strategyName: this.strategy.name,
                    toolNames: Array.from(currentToolMap.keys()),
                    restTools: this.restTools,
                    providerConfig: {
                      type: this.provider.constructor.name,
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
                } as unknown as AgentState,
                300,
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
              await this.executeToolCall(
                toolCallResult,
                currentToolMap,
                assistantContent,
                reasoningContent,
                iteration,
                onPacket,
                state,
                circuit,
                degradation,
                totalInputTokensSum,
                maxContextTokens ?? 0,
              );
            } else if (!hasContentEmitted && assistantContent) {
              await this.emitContent(onPacket, iteration, assistantContent);
            } else {
              logger.info(
                `[runMission] Iter ${iteration}: no toolCall â€” entering autoRecovery (contentLen=${assistantContent.length}, hasContentEmitted=${hasContentEmitted})`,
              );
              const { isComplete: turnComplete, retryWithTool } = await this.handleAutoRecovery(
                assistantContent,
                reasoningContent,
                iteration,
                onPacket,
                state,
                currentToolMap,
              );
              isComplete = turnComplete;
              if (retryWithTool) {
                await this.executeToolCall(
                  retryWithTool,
                  currentToolMap,
                  assistantContent,
                  reasoningContent,
                  iteration,
                  onPacket,
                  state,
                  circuit,
                  degradation,
                  totalInputTokensSum,
                  maxContextTokens ?? 0,
                );
              }
              if (!isComplete && !hasContentEmitted && assistantContent) {
                await this.emitContent(onPacket, iteration, assistantContent);
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
            await stateStorage.set(state.missionId, state, 600);
          } catch (err: unknown) {
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
      };

      if (span?.otelSpan) {
        await context.with(otelTrace.setSpan(context.active(), span.otelSpan), executeTurn);
      } else {
        await executeTurn();
      }
    }

    if (iteration >= maxIterations) {
      logger.warn(`Max iterations reached`, { missionId: state.missionId });
      await this.updateStatus(onPacket, { state: "aborted" }, iteration);
    } else if (isComplete) {
      await this.updateStatus(onPacket, { state: "completed" }, iteration);
    }

    await this.emitTurnComplete(onPacket, iteration, isComplete, iteration, this.totalCostUsd);

    await stateStorage.set(state.missionId, state, 600);

    if (ENV.DEBUG_PROMPT || ENV.NODE_ENV === DEBUG_CONFIG.ENV) {
      queuePromptDebug({
        state,
        iteration,
        strategyName: this.strategy.name,
        systemPrompt,
      });
    }

    if (trace) {
      trace.update({
        output: {
          completed: isComplete,
          totalIterations: iteration,
        },
      });
      trace.end();
      logger.info("Langfuse trace ended successfully.");
    }
  }
}
