import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { AgentState, AgentStrategy, LLMProvider, ToolDefinition } from "../../../shared/types";
import { getHistoryTokens, selectiveTruncateToolResults } from "../../../shared/utils/harness";
import { logger } from "../../../shared/utils/logger";
import type { BehaviorPrompt } from "../prompts";
import { StrategyFactory } from "../strategies/factory";
import { HARNESS_CONFIG } from "./constants";
import type { DegradationLevel, DegradationManager } from "./degradation";
import type { HarnessEventEmitter } from "./events";
import { HARNESS_PROMPTS } from "./prompts";
import { isFakeToolTrace } from "./trace-guard";
import type { HarnessEvent } from "./types";
import { hasProtocolMarkup, parseXmlToolCall } from "./xml_tool_parser";

export interface StrategyRef {
  current: AgentStrategy;
}

export interface RecoveryHandlerDeps {
  provider: LLMProvider;
  strategyRef: StrategyRef;
  getCompressionEnabled: () => boolean;
  behaviorPrompt: BehaviorPrompt | null;
  emitter: HarnessEventEmitter;
}

export class RecoveryHandler {
  constructor(private readonly deps: RecoveryHandlerDeps) {}

  async checkStuckState(objective: string, assistantContent: string): Promise<boolean> {
    try {
      const systemPrompt = HARNESS_PROMPTS.STUCK_CLASSIFIER_SYSTEM;
      const userPrompt = HARNESS_PROMPTS.STUCK_CLASSIFIER_USER(objective, assistantContent);

      const checkStream = this.deps.provider.stream([new HumanMessage(userPrompt)], [], systemPrompt);

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

  async handleDegradation(
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

    await this.deps.emitter.emitDegraded(onPacket, iteration, fromStr, toStr, reasonStr);

    let systemPrompt = "";
    const toolMap = new Map<string, ToolDefinition>();

    if (currentLevel === "restricted") {
      state.messages.push(new HumanMessage("System: tool execution errors detected. Continuing with knowledge only."));
      systemPrompt = this.deps.strategyRef.current.buildSystemPrompt(state, [], this.deps.behaviorPrompt);
    } else if (currentLevel === "standard") {
      state.messages.push(new HumanMessage("System: switching to direct response."));
      this.deps.strategyRef.current = StrategyFactory.create("standard");
      const anchor = state.messages[0];
      const lastUserMsg = [...state.messages].reverse().find((m) => m._getType() === "human");
      state.messages = lastUserMsg ? [anchor, lastUserMsg] : [anchor];
      systemPrompt = this.deps.strategyRef.current.buildSystemPrompt(state, [], this.deps.behaviorPrompt);
    }

    return { systemPrompt, toolMap, lastDegradationLevel: currentLevel };
  }

  async handleCompaction(
    state: AgentState,
    iteration: number,
    onPacket: (p: HarnessEvent) => Promise<void>,
  ): Promise<void> {
    if (!this.deps.getCompressionEnabled() || !this.deps.provider.maxContextTokens) return;
    const maxContextTokens = this.deps.provider.maxContextTokens;
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
        const compactEventStream = this.deps.provider.stream(
          [anchor, ...msgsToCompact, new HumanMessage(HARNESS_PROMPTS.COMPACTION_PROMPT)],
          [],
          HARNESS_PROMPTS.COMPACTION_SYSTEM,
        );
        for await (const ev of compactEventStream) {
          if (ev.content) summaryText += ev.content;
        }
        await this.deps.provider.cleanupReasoning?.();
      }

      const summaryMsg = summaryText
        ? [new AIMessage(HARNESS_PROMPTS.COMPACTION_SUMMARY_WRAPPER(iteration, summaryText))]
        : [];
      state.messages = [anchor, ...summaryMsg, ...droppedLastTurns];

      logger.info("Context compaction successfully applied.");
      await this.deps.emitter.emitReasoning(
        onPacket,
        iteration,
        HARNESS_PROMPTS.LOG_COMPACTED(getHistoryTokens(state.messages)),
      );
    } catch (err: unknown) {
      const compactionError = err as { message?: string };
      logger.langfuse("ERROR", `Context compaction failed: ${compactionError.message}`, {
        error: compactionError.message,
      });
    }
  }

  async handleAutoRecovery(
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
}
