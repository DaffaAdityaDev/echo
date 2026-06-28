import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { LLMProvider, AgentState, AgentStrategy, ToolDefinition, HarnessPacket, AgentPacketType } from '../../../../shared/types';
import { toolRegistry } from '../../tools/registry';
import { logger } from '../../../../shared/utils/logger';

import { getCosineSimilarity, getHistoryTokens, selectiveTruncateToolResults } from '../../../../utils/harness';
import { ENV } from '../../../../config/env';
import { stateStorage } from '../../storage/factory';
import { ToolRetriever } from '../../services/retriever';
import { startAgentTrace, langfuseStorage } from '../../../../utils/langfuse';
import { context, trace as otelTrace } from "@opentelemetry/api";
import { 
    HARNESS_CONFIG, 
    DEBUG_CONFIG,
    OPERATION_STATUS, 
    PACKET_TYPES 
} from "./constants";
import { HARNESS_PROMPTS } from "./prompts";
import { calculateUsageCost } from "../../../../infrastructure/providers/utils";
import { queuePromptDebug } from "./utils/debug";
import { AgentHarness, HarnessConfig } from '../types';
import { cancellationManager } from '../cancel_manager';

export class NlahHarness implements AgentHarness {
    private provider: LLMProvider;
    private strategy: AgentStrategy;
    private missionId: string;
    private tenantId: string;
    private explicitTools?: ToolDefinition[];
    private static toolRetriever: ToolRetriever | null = null;

    constructor(options: HarnessConfig) {
        this.provider = options.provider;
        this.strategy = options.strategy;
        this.missionId = options.missionId || crypto.randomUUID();
        this.tenantId = options.tenantId || HARNESS_CONFIG.DEFAULT_TENANT_ID;
        this.explicitTools = options.tools;

        if (!NlahHarness.toolRetriever) {
            NlahHarness.toolRetriever = new ToolRetriever(toolRegistry.getAllTools());
        }
    }

    private async emit(onPacket: (p: any) => Promise<void>, type: AgentPacketType, payload: Partial<HarnessPacket>, step: number) {
        await onPacket({ 
            type, 
            missionId: this.missionId,
            step,
            timestamp: Date.now(),
            ...payload 
        });
    }

    private async checkStuckState(objective: string, assistantContent: string): Promise<boolean> {
        try {
            const systemPrompt = HARNESS_PROMPTS.STUCK_CLASSIFIER_SYSTEM;
            const userPrompt = HARNESS_PROMPTS.STUCK_CLASSIFIER_USER(objective, assistantContent);

            const checkStream = this.provider.stream(
                [new HumanMessage(userPrompt)],
                [],
                systemPrompt
            );

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

    async runMission(
        state: AgentState,
        onPacket: (packet: any) => Promise<void>,
        traceparent?: string
    ) {
        this.missionId = state.missionId;

        await this.emit(onPacket, PACKET_TYPES.METADATA, {
            content: `Initializing state registry context.`
        }, 0);

        let traceId = crypto.randomUUID().replace(/-/g, "");
        let parentSpanId = "";
        if (traceparent && traceparent.startsWith("00-")) {
            const parts = traceparent.split("-");
            if (parts.length >= 3) {
                traceId = parts[1];
                parentSpanId = parts[2];
            }
        }

        const trace = startAgentTrace(traceId, state.missionId, this.tenantId, this.strategy.name, state.objective);

        const allPhysicalTools = this.explicitTools || toolRegistry.getAllTools();
        const isSubAgent = this.tenantId === HARNESS_CONFIG.SUBAGENT_TENANT_ID;

        // Filter out delegation to prevent infinite recursion loop
        let filteredPhysicalTools = allPhysicalTools;
        if (isSubAgent) {
            filteredPhysicalTools = allPhysicalTools.filter(
                t => t.name !== 'delegate_task'
            );
        }

        // If tools are explicitly bound, we bypass the retriever and bind all of them (minus delegation for sub-agents)
        let tools = this.explicitTools 
            ? filteredPhysicalTools 
            : NlahHarness.toolRetriever!.getRelevantTools(state.objective, filteredPhysicalTools);
        
        // Optimasi pencarian tool dari O(T) ke O(1) menggunakan Map Lookup table
        let toolMap = new Map<string, ToolDefinition>(tools.map(t => [t.name, t]));
        
        const systemPrompt = this.strategy.buildSystemPrompt(state, tools);

        await this.emit(onPacket, PACKET_TYPES.METADATA, {
            meta: {
                missionId: state.missionId,
                strategy: this.strategy.name,
                historyDepth: state.messages.length,
                toolsAvailable: tools.map(t => t.name),
                objective: state.objective,
                maxIterations: HARNESS_CONFIG.MAX_ITERATIONS,
            }
        }, state.tasks.length);

        let isComplete = false;
        let iteration = state.tasks.length;
        const maxIterations = HARNESS_CONFIG.MAX_ITERATIONS;
        const maxContextTokens = this.provider.maxContextTokens ?? HARNESS_CONFIG.DEFAULT_MAX_CONTEXT_TOKENS;
        if (this.provider.maxContextTokens === undefined) {
            logger.warn(`maxContextTokens undefined for provider=${this.provider.constructor.name} model=${this.provider.modelName ?? 'unknown'}. Using fallback=${HARNESS_CONFIG.DEFAULT_MAX_CONTEXT_TOKENS}.`);
        }

        let totalCost = 0;
        let cachedTokensSum = 0;
        let totalInputTokensSum = 0;
        const costThreshold = HARNESS_CONFIG.COST_THRESHOLD;
        let previousThought = "";

        while (!isComplete && iteration < maxIterations) {
            if (cancellationManager.isAborted(this.missionId)) {
                logger.info(`NlahHarness: Mission ${this.missionId} cancelled, aborting harness run.`);
                await this.emit(onPacket, PACKET_TYPES.METADATA, {
                    content: `Mission execution cancelled.`
                }, iteration);
                break;
            }
            iteration++;
            let span: any = null;
            if (trace) {
                span = trace.startObservation(`turn-${iteration}`, {
                    input: {
                        messagesCount: state.messages.length
                    }
                }, { asType: "span" });
            }

            logger.info(`Agent iteration ${iteration}`, { 
                missionId: state.missionId,
                traceId: trace?.traceId,
                spanId: span?.id
            });

            const executeTurn = async () => {
                await langfuseStorage.run({ trace, span, sessionId: state.missionId, userId: this.tenantId }, async () => {
                    try {
                        if (iteration > HARNESS_CONFIG.PACING_THRESHOLD) {
                            logger.warn(`Cognitive pacing threshold crossed (iteration: ${iteration}). Injecting forced synthesis.`);
                            const pacingWarning = HARNESS_PROMPTS.PACING_WARNING(iteration);
                            state.messages.push(new HumanMessage(pacingWarning));
                            // Revoke tool access — LLM has no choice but to synthesize final answer
                            tools = [];
                            toolMap = new Map();
                        }

                        // OPTIMASI 1: Ambil token history sekali saja di awal turn
                        let currentTokens = getHistoryTokens(state.messages);
                        let tokenUsageRatio = currentTokens / maxContextTokens;
                        logger.info(`Current estimated context usage: ${currentTokens}/${maxContextTokens} tokens (${(tokenUsageRatio * 100).toFixed(1)}%)`);

                        if (tokenUsageRatio > HARNESS_CONFIG.COMPACTION_RATIO) {
                            logger.info(`Compacting conversation context due to high token ratio (${(tokenUsageRatio * 100).toFixed(1)}%)`);
                            try {
                                const compactionPrompt = HARNESS_PROMPTS.COMPACTION_PROMPT;
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
                                        [anchor, ...msgsToCompact, new HumanMessage(compactionPrompt)],
                                        [],
                                        HARNESS_PROMPTS.COMPACTION_SYSTEM
                                    );

                                    for await (const ev of compactEventStream) {
                                        if (ev.content) summaryText += ev.content;
                                    }
                                    await this.provider.cleanupReasoning?.();
                                }

                                const summaryMsg = summaryText 
                                    ? [new AIMessage(HARNESS_PROMPTS.COMPACTION_SUMMARY_WRAPPER(iteration, summaryText))]
                                    : [];

                                state.messages = [
                                    anchor,
                                    ...summaryMsg,
                                    ...droppedLastTurns
                                ];

                                currentTokens = getHistoryTokens(state.messages);

                                logger.info("Context compaction successfully applied.");
                                await this.emit(onPacket, PACKET_TYPES.REASONING, {
                                    content: HARNESS_PROMPTS.LOG_COMPACTED(currentTokens)
                                }, iteration);
                            } catch (err: any) {
                                logger.langfuse("ERROR", `Context compaction failed: ${err.message}`, { error: err.message });
                            }
                        }

                        // ==================== PROMPT DEBUG GATES ====================
                        if (ENV.DEBUG_PROMPT || ENV.NODE_ENV === DEBUG_CONFIG.ENV) {
                            queuePromptDebug({
                                state,
                                iteration,
                                strategyName: this.strategy.name,
                                systemPrompt
                            });
                            logger.info(`📝 Prompt debug operations queued in background`);

                            try {
                                await this.emit(onPacket, PACKET_TYPES.DEBUG, {
                                    meta: {
                                        rawSystemPrompt: systemPrompt,
                                        currentHistoryLength: state.messages.length,
                                        rawMessages: state.messages.map(m => ({ role: m._getType(), content: m.content }))
                                    }
                                }, iteration);
                            } catch (emitErr) {
                                logger.error("Failed to emit debug packet", emitErr);
                            }
                        }
                        // ============================================================

                        const eventStream = this.provider.stream(state.messages, tools, systemPrompt);

                        let assistantContent = "";
                        let reasoningContent = "";
                        let pendingToolCall: { name: string; args: Record<string, unknown> } | null = null;
                        let hasContentEmitted = false;

                        for await (const event of eventStream) {
                            if (event.reasoning) {
                                reasoningContent += event.reasoning;
                                await this.emit(onPacket, PACKET_TYPES.REASONING, { content: event.reasoning }, iteration);
                            }
                            if (event.content) assistantContent += event.content;
                            if (event.toolCall) pendingToolCall = event.toolCall;

                            if (event.content && !pendingToolCall) {
                                hasContentEmitted = true;
                                await this.emit(onPacket, PACKET_TYPES.CONTENT, { content: event.content }, iteration);
                            }
                            if (event.usage) {
                                await this.emit(onPacket, PACKET_TYPES.USAGE, { meta: event.usage as any }, iteration);

                                const promptTokens = event.usage.promptTokens;
                                const completionTokens = event.usage.completionTokens;
                                const cachedTokens = event.usage.cachedTokens ?? 0;

                                const modelName = this.provider.modelName || "unknown";
                                const baseURL = this.provider.baseURL || "unknown";

                                const { stepCost } = calculateUsageCost(modelName, baseURL, promptTokens, completionTokens, cachedTokens);
                                totalCost += stepCost;
                                totalInputTokensSum += promptTokens;
                                cachedTokensSum += cachedTokens;

                                const cacheRatio = totalInputTokensSum > 0 ? (cachedTokensSum / totalInputTokensSum) : 0;
                                logger.info(`Session Accumulated Spend: $${totalCost.toFixed(5)} USD | Cache Ratio: ${(cacheRatio * 100).toFixed(1)}%`);

                                if (totalCost >= costThreshold) {
                                    const errMsg = HARNESS_PROMPTS.FINANCIAL_ABORT(costThreshold, totalCost);
                                    logger.langfuse("ERROR", errMsg);
                                    throw new Error(errMsg);
                                }
                            }
                        }

                        const currentThought = assistantContent;
                        if (previousThought && currentThought) {
                            const sim = getCosineSimilarity(previousThought, currentThought);
                            logger.info(`Semantic cosine similarity calculated: ${sim.toFixed(4)}`);
                            if (sim >= HARNESS_CONFIG.SIMILARITY_THRESHOLD) {
                                const warningMsg = HARNESS_PROMPTS.REPEATING_WARNING;
                                logger.langfuse("WARN", `Semantic similarity threshold crossed (sim: ${sim.toFixed(4)}). Injecting loop warning.`);
                                state.messages.push(new HumanMessage(warningMsg));
                            }
                        }
                        previousThought = currentThought;

                        const currentSpanId = `s_turn_${iteration}`;
                        logger.telemetry("llm_call", {
                            traceId,
                            spanId: currentSpanId,
                            parentSpanId: parentSpanId || traceId,
                            sessionId: state.missionId,
                            metadata: {
                                model: this.provider.constructor.name,
                                prompt_cached_tokens: cachedTokensSum,
                                total_tokens: totalInputTokensSum,
                                monetary_cost_usd: totalCost,
                                prompt_prefix_cache_hit: iteration > 1
                            },
                            input: {
                                messages: state.messages.map(m => ({ role: m._getType(), content: m.content }))
                            },
                            output: {
                                thought: assistantContent,
                                tool_calls: pendingToolCall ? [{ name: pendingToolCall.name, args: pendingToolCall.args }] : []
                            }
                        });

                        // ========================================================================
                        // 🧠 NLAH AUTONOMOUS AUTO-RECOVER ENGINE
                        // ========================================================================
                        if (pendingToolCall) {
                            // 1. KONDISI NORMAL: Native Tool Call terdeteksi oleh Provider
                            const tool = toolMap.get(pendingToolCall.name);
                            if (tool) {
                                logger.info(`Executing tool: ${pendingToolCall.name}`, { missionId: state.missionId });

                                await this.emit(onPacket, PACKET_TYPES.TOOL_CALL, {
                                    toolName: pendingToolCall.name,
                                    toolInput: pendingToolCall.args
                                }, iteration);

                                if (pendingToolCall.name === 'write_todos') {
                                    await this.emit(onPacket, PACKET_TYPES.TODO, {
                                        todos: pendingToolCall.args.todos as any
                                    }, iteration);
                                    state.tasks = pendingToolCall.args.todos as any[];
                                } else if (pendingToolCall.name === 'delegate_task') {
                                    await this.emit(onPacket, PACKET_TYPES.SUBAGENT_CALL, {
                                        subagent: {
                                            name: pendingToolCall.args.agentName as string,
                                            instruction: pendingToolCall.args.instruction as string,
                                            status: 'calling'
                                        }
                                    }, iteration);
                                }

                                let toolSpan: any = null;
                                if (span) {
                                    toolSpan = span.startObservation(`tool-${pendingToolCall.name}`, {
                                        input: pendingToolCall.args
                                    }, { asType: "tool" });
                                }

                                let observation;
                                try {
                                    observation = await tool.execute(pendingToolCall.args, {
                                        parentMessages: state.messages,
                                        onPacket,
                                        provider: this.provider,
                                        tools
                                    });
                                    if (toolSpan) {
                                        toolSpan.update({
                                            output: observation,
                                            level: observation.status === OPERATION_STATUS.ERROR ? "ERROR" : "DEFAULT"
                                        });
                                    }
                                 } catch (err: any) {
                                     logger.error(`Tool execution failed for ${pendingToolCall.name}: ${err.message}`, err);
                                     if (toolSpan) {
                                         toolSpan.update({
                                             level: "ERROR",
                                             statusMessage: err.message
                                         });
                                     }
                                     observation = {
                                         status: OPERATION_STATUS.ERROR,
                                         summary: `Tool execution failed: Failed to perform ${pendingToolCall.name}. Please try again later or refine the request.`,
                                         error: 'TOOL_EXECUTION_FAILED'
                                     };
                                 } finally {
                                    if (toolSpan) {
                                        toolSpan.end();
                                    }
                                }

                                const finalSummary = observation.summary;

                                if (pendingToolCall.name === 'delegate_task') {
                                    await this.emit(onPacket, PACKET_TYPES.SUBAGENT_RESULT, {
                                        subagent: {
                                            name: pendingToolCall.args.agentName as string,
                                            instruction: pendingToolCall.args.instruction as string,
                                            result: observation.summary,
                                            status: observation.status === 'success' ? 'completed' : 'failed'
                                        }
                                    }, iteration);
                                }

                                const toolCallId = `tool_${Date.now()}`;
                                state.messages.push(new AIMessage({
                                    content: assistantContent,
                                    tool_calls: [{
                                        id: toolCallId,
                                        name: pendingToolCall.name,
                                        args: pendingToolCall.args,
                                        type: "tool_call"
                                    }],
                                    additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined
                                }));
                                state.messages.push(new ToolMessage({
                                    tool_call_id: toolCallId,
                                    content: finalSummary
                                }));

                                await this.emit(onPacket, PACKET_TYPES.TOOL_RESULT, {
                                    toolName: pendingToolCall.name,
                                    content: finalSummary,
                                    toolResult: observation.data
                                }, iteration);

                            } else {
                                logger.warn(`Tool not found: ${pendingToolCall.name} (possibly pacing forced synthesis)`, { missionId: state.missionId });
                                state.messages.push(new AIMessage({
                                    content: assistantContent,
                                    additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined
                                }));
                                if (!hasContentEmitted && assistantContent) {
                                    await this.emit(onPacket, PACKET_TYPES.CONTENT, { content: assistantContent }, iteration);
                                }
                                isComplete = true;
                            }

                        } else if (assistantContent.includes('<tool_call>') || assistantContent.includes('</tool_call>')) {
                            // 2. TIER 1 AUTO-RECOVER: Soft Recovery (Format Tolerance)
                            logger.warn(`[NLAH RECOVER] Soft Recovery triggered. Parsing raw XML tool syntax.`);
                            
                            const funcMatch = assistantContent.match(/<function=(.*?)>/);
                            if (funcMatch) {
                                const toolName = funcMatch[1].trim();
                                const args: Record<string, unknown> = {};
                                const paramRegex = /<parameter=(.*?)>\s*([\s\S]*?)\s*<\/parameter>/g;
                                let match;
                                
                                while ((match = paramRegex.exec(assistantContent)) !== null) {
                                    let val: any = match[2].trim();
                                    if (val === 'false') val = false;
                                    if (val === 'true') val = true;
                                    args[match[1].trim()] = val;
                                }

                                pendingToolCall = { name: toolName, args };
                                logger.info(`[NLAH RECOVER] Successfully extracted tool: ${toolName}. Retrying loop.`);
                                
                                state.messages.push(new AIMessage({
                                    content: assistantContent,
                                    additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined
                                }));
                                state.messages.push(new ToolMessage({ 
                                    tool_call_id: `fallback_${Date.now()}`, 
                                    content: HARNESS_PROMPTS.LOG_RE_ROUTE
                                }));
                            } else {
                                logger.error(`[NLAH RECOVER] XML detected but unparseable. Escalating to Tier 2.`);
                                const recoveryPrompt = HARNESS_PROMPTS.RECOVERY_PROMPT;
                                state.messages.push(new HumanMessage(recoveryPrompt));
                            }

                        } else {
                            // 3. TIER 2 AUTO-RECOVER: Feedback Recovery (Anti-Stuck Check)
                            const looksLikeThinking = await this.checkStuckState(state.objective, assistantContent);
                            
                            if (looksLikeThinking && iteration < maxIterations) {
                                logger.warn(`[NLAH RECOVER] Tier 2 Feedback Recovery triggered. Agent halted in thinking state.`);
                                const feedbackPrompt = HARNESS_PROMPTS.FEEDBACK_PROMPT;
                                
                                state.messages.push(new AIMessage({
                                    content: assistantContent,
                                    additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined
                                }));
                                state.messages.push(new HumanMessage(feedbackPrompt));
                            } else {
                                state.messages.push(new AIMessage({
                                    content: assistantContent,
                                    additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined
                                }));
                                isComplete = true;
                                if (!hasContentEmitted && assistantContent) {
                                    await this.emit(onPacket, PACKET_TYPES.CONTENT, { content: assistantContent }, iteration);
                                }
                            }
                        }

                        if (span) {
                            span.update({
                                output: {
                                    thought: assistantContent,
                                    toolCalls: pendingToolCall ? [{ name: pendingToolCall.name, args: pendingToolCall.args }] : []
                                }
                            });
                            span.end();
                        }
                        await stateStorage.set(state.missionId, state);
                    } catch (err: any) {
                        logger.langfuse("ERROR", `Turn execution failed: ${err.message}`, { error: err.stack || err.message });
                        if (span) {
                            span.update({
                                level: "ERROR",
                                statusMessage: err.message
                            });
                            span.end();
                        }
                        throw err;
                    }
                });
            };

            if (span && span.otelSpan) {
                await context.with(otelTrace.setSpan(context.active(), span.otelSpan), executeTurn);
            } else {
                await executeTurn();
            }
        }

        if (iteration >= maxIterations) {
            logger.warn(`Max iterations reached`, { missionId: state.missionId });
        }

        await stateStorage.set(state.missionId, state);

        // Queue final debug log to ensure the last messages (last AI + Tool response) are captured
        if (ENV.DEBUG_PROMPT || ENV.NODE_ENV === DEBUG_CONFIG.ENV) {
            queuePromptDebug({
                state,
                iteration,
                strategyName: this.strategy.name,
                systemPrompt
            });
        }

        if (trace) {
            trace.update({
                output: {
                    completed: isComplete,
                    totalIterations: iteration
                }
            });
            trace.end();
            logger.info("Langfuse trace ended successfully.");
        }
    }
}
