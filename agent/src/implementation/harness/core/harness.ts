import { HumanMessage, AIMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";
import { LLMProvider, AgentState, AgentStrategy, ToolDefinition } from '../types';
import { toolRegistry } from '../tools/registry';
import { logger } from '../../../shared/utils/logger';
import { DelegationTool } from '../tools/definitions/delegation';
import { PATHS } from '../../../shared/constants';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

function getCosineSimilarity(text1: string, text2: string): number {
    const tokenize = (text: string) => {
        return text.toLowerCase().match(/\b\w+\b/g) || [];
    };
    const tokens1 = tokenize(text1);
    const tokens2 = tokenize(text2);
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    const freq1: Record<string, number> = {};
    const freq2: Record<string, number> = {};
    const allWords = new Set<string>();

    for (const w of tokens1) {
        freq1[w] = (freq1[w] || 0) + 1;
        allWords.add(w);
    }
    for (const w of tokens2) {
        freq2[w] = (freq2[w] || 0) + 1;
        allWords.add(w);
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (const w of allWords) {
        const val1 = freq1[w] || 0;
        const val2 = freq2[w] || 0;
        dotProduct += val1 * val2;
        mag1 += val1 * val1;
        mag2 += val2 * val2;
    }

    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

export interface HarnessOptions {
    provider: LLMProvider;
    strategy: AgentStrategy;
}

/**
 * Typed packet protocol — the frontend reacts to `type` to render correctly.
 */
type PacketType =
    | 'content'
    | 'reasoning'
    | 'tool_call'
    | 'tool_result'
    | 'metadata'
    | 'usage'
    | 'todo'
    | 'subagent_call'
    | 'subagent_result'
    | 'file_operation';

interface HarnessPacket {
    type: PacketType;
    content?: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
    meta?: Record<string, unknown>;
    todos?: Array<{ id: string; description: string; status: string }>;
    subagent?: {
        name: string;
        instruction: string;
        result?: string;
        status: 'calling' | 'completed' | 'failed';
    };
    fileOp?: {
        operation: 'write' | 'read' | 'offload';
        path: string;
        preview?: string;
    };
}

export class AgentHarness {
    private provider: LLMProvider;
    private strategy: AgentStrategy;

    constructor(options: HarnessOptions) {
        this.provider = options.provider;
        this.strategy = options.strategy;
    }

    private async emit(onPacket: (p: any) => Promise<void>, type: PacketType, payload: Partial<HarnessPacket>) {
        await onPacket({ type, ...payload });
    }

    private getStatePath(missionId: string): string {
        return join(PATHS.OFFLOAD_ROOT, `state_${missionId}.json`);
    }

    private async saveState(state: AgentState) {
        try {
            const statePath = this.getStatePath(state.missionId);
            const serialized = {
                missionId: state.missionId,
                objective: state.objective,
                tasks: state.tasks,
                currentTaskId: state.currentTaskId,
                memory: state.memory,
                messages: state.messages.map(m => ({
                    role: m._getType(),
                    content: m.content,
                    tool_calls: (m as any).tool_calls,
                    tool_call_id: (m as any).tool_call_id
                }))
            };
            await mkdir(PATHS.OFFLOAD_ROOT, { recursive: true });
            await writeFile(statePath, JSON.stringify(serialized, null, 2), 'utf-8');
            logger.info(`Durable Checkpoint saved for mission ${state.missionId}`);
        } catch (err: any) {
            logger.error("Failed to save durable checkpoint", err);
        }
    }

    async runMission(
        message: string,
        history: BaseMessage[],
        onPacket: (packet: any) => Promise<void>,
        missionId?: string,
        traceparent?: string
    ) {
        let state: AgentState;
        const statePath = missionId ? this.getStatePath(missionId) : "";
        if (missionId && existsSync(statePath)) {
            try {
                const raw = await readFile(statePath, 'utf-8');
                const parsed = JSON.parse(raw);
                state = {
                    missionId: parsed.missionId,
                    objective: parsed.objective,
                    tasks: parsed.tasks || [],
                    currentTaskId: parsed.currentTaskId,
                    memory: parsed.memory || {},
                    messages: parsed.messages.map((m: any) => {
                        if (m.role === 'human') return new HumanMessage(m.content);
                        if (m.role === 'ai') return new AIMessage({ content: m.content, tool_calls: m.tool_calls });
                        if (m.role === 'tool') return new ToolMessage({ content: m.content, tool_call_id: m.tool_call_id });
                        return new AIMessage(m.content);
                    })
                };
                logger.info(`Durable Checkpoint loaded for mission ${missionId}`);
                state.messages.push(new HumanMessage(message));
            } catch (err: any) {
                logger.error(`Failed to load durable checkpoint for mission ${missionId}, starting fresh`, err);
                state = {
                    missionId: missionId,
                    objective: message,
                    tasks: [],
                    memory: {},
                    messages: [...history, new HumanMessage(message)]
                };
            }
        } else {
            state = {
                missionId: missionId || crypto.randomUUID(),
                objective: message,
                tasks: [],
                memory: {},
                messages: [...history, new HumanMessage(message)]
            };
        }

        // Traceparent context propagation parsing
        let traceId = crypto.randomUUID().replace(/-/g, "");
        let parentSpanId = "";
        if (traceparent && traceparent.startsWith("00-")) {
            const parts = traceparent.split("-");
            if (parts.length >= 3) {
                traceId = parts[1];
                parentSpanId = parts[2];
            }
        }

        // Initialize and dynamically register delegation tool
        const delegationTool = new DelegationTool(this.provider).getToolDefinition();
        const tools = [...toolRegistry.getAllTools(), delegationTool];
        const systemPrompt = this.strategy.buildSystemPrompt(state, tools);

        // Emit metadata packet so the frontend/user knows what context is active
        await this.emit(onPacket, 'metadata', {
            meta: {
                missionId: state.missionId,
                strategy: this.strategy.name,
                historyDepth: history.length,
                toolsAvailable: tools.map(t => t.name),
                objective: message,
            }
        });
        let isComplete = false;
        let iteration = 0;
        const maxIterations = 15; // Increased for sub-agent runs
        const MAX_CONTEXT_TOKENS = 16384; // Typical model limit

        // Real-time financial/spend variables
        let totalCost = 0;
        let cachedTokensSum = 0;
        let totalInputTokensSum = 0;
        const costThreshold = 1.00; // $1.00 USD maximum spend per session
        let previousThought = "";

        // Helper to estimate current token usage (1 token ≈ 4 characters)
        const getHistoryTokens = (msgs: BaseMessage[]): number => {
            return msgs.reduce((acc, m) => acc + Math.ceil((m.content || "").toString().length / 4), 0);
        };

        // Helper to detect placeholders and validate code syntax
        const validateContent = (filename: string, content: string): { valid: boolean; reason?: string } => {
            const placeholders = [
                /\[Not available\]/i,
                /\(need to extract\)/i,
                /\(list if available\)/i,
                /placeholder/i,
                /insert here/i,
                /\[The abstract text was not extracted\]/i
            ];
            for (const pattern of placeholders) {
                if (pattern.test(content)) {
                    return {
                        valid: false,
                        reason: `Content contains invalid placeholder: ${pattern.toString()}`
                    };
                }
            }

            // Code syntax checking
            const ext = filename.split('.').pop()?.toLowerCase();
            if (ext === 'json') {
                try {
                    JSON.parse(content);
                } catch (err: any) {
                    return { valid: false, reason: `Invalid JSON syntax: ${err.message}` };
                }
            } else if (ext === 'ts' || ext === 'js' || ext === 'tsx' || ext === 'jsx') {
                try {
                    const sourceFile = ts.createSourceFile(
                        filename,
                        content,
                        ts.ScriptTarget.Latest,
                        true
                    );
                    const diagnostics = (sourceFile as any).parseDiagnostics || [];
                    if (diagnostics.length > 0) {
                        const errors = diagnostics
                            .slice(0, 3)
                            .map((d: any) => `${d.messageText} (at line ${sourceFile.getLineAndCharacterOfPosition(d.start).line + 1})`)
                            .join(', ');
                        return { valid: false, reason: `Syntax errors detected: ${errors}` };
                    }
                } catch (err: any) {
                    return { valid: false, reason: `Failed to compile/parse JS/TS: ${err.message}` };
                }
            }
            return { valid: true };
        };

        while (!isComplete && iteration < maxIterations) {
            iteration++;
            logger.info(`Agent iteration ${iteration}`, { missionId: state.missionId });

            // Cognitive Pacing warning injection if looping too much
            if (iteration > 8) {
                logger.warn(`Cognitive pacing threshold crossed (iteration: ${iteration}). Injecting pacing guideline.`);
                state.messages.push(new HumanMessage(
                    `[SYSTEM PACING WARNING]: You have taken ${iteration} turns. Please analyze if you are stuck in a loop. Adjust your plan, summarize what works, and move towards final synthesis to preserve execution budget.`
                ));
            }

            const currentTokens = getHistoryTokens(state.messages);
            const tokenUsageRatio = currentTokens / MAX_CONTEXT_TOKENS;
            logger.info(`Current estimated context usage: ${currentTokens}/${MAX_CONTEXT_TOKENS} tokens (${(tokenUsageRatio * 100).toFixed(1)}%)`);

            // 1. Dynamic Context Compaction Flow (Trigger when usage > 80%)
            if (tokenUsageRatio > 0.8) {
                logger.info(`Compacting conversation context due to high token ratio (${(tokenUsageRatio * 100).toFixed(1)}%)`);
                try {
                    const compactionPrompt = `Summarize the conversation so far. You MUST return your response as a dense, structured JSON block (wrapped in a markdown code block) with the following schema:
{
  "decisions": ["list of key technical decisions"],
  "accomplishments": ["list of tasks completed"],
  "facts": {"key_variable": "value"},
  "pending_challenges": ["remaining roadblocks to solve"]
}
Return ONLY this structured JSON.`;

                    const compactEventStream = this.provider.stream(
                        [...state.messages, new HumanMessage(compactionPrompt)],
                        [],
                        "You are a structured state summarization system."
                    );

                    let summaryText = "";
                    for await (const ev of compactEventStream) {
                        if (ev.content) summaryText += ev.content;
                    }

                    // Compact history: keep system prompt context (implicit), initial query, and this state summary
                    state.messages = [
                        new HumanMessage(state.objective),
                        new AIMessage(`[Context Compaction Structured State Summary of Steps 1-${iteration - 1}]:\n${summaryText}`)
                    ];

                    logger.info("Context compaction successfully applied.");
                    await this.emit(onPacket, 'reasoning', {
                        content: `*[System: Context compacted. Accumulated history of ${currentTokens} tokens summarized into structured high-density state to avoid context window bloating.]*`
                    });
                } catch (err: any) {
                    logger.error("Context compaction failed", err);
                }
            }

            const eventStream = this.provider.stream(state.messages, tools, systemPrompt);

            let assistantContent = "";
            let pendingToolCall: { name: string; args: Record<string, unknown> } | null = null;

            for await (const event of eventStream) {
                if (event.content) assistantContent += event.content;
                if (event.toolCall) pendingToolCall = event.toolCall;

                // Route to the correct display area via typed packets
                if (event.reasoning) {
                    await this.emit(onPacket, 'reasoning', { content: event.reasoning });
                }
                if (event.content && !pendingToolCall) {
                    await this.emit(onPacket, 'content', { content: event.content });
                }
                if (event.usage) {
                    await this.emit(onPacket, 'usage', { meta: event.usage as any });

                    const promptTokens = event.usage.promptTokens;
                    const completionTokens = event.usage.completionTokens;

                    // Accumulate cost
                    const stepCost = (promptTokens * 0.0015 + completionTokens * 0.0060) / 1000;
                    totalCost += stepCost;
                    totalInputTokensSum += promptTokens;

                    if (iteration > 1) {
                        cachedTokensSum += Math.floor(promptTokens * 0.7); // simulated prompt caching ratio
                    }

                    const cacheRatio = totalInputTokensSum > 0 ? (cachedTokensSum / totalInputTokensSum) : 0;
                    logger.info(`Session Accumulated Spend: $${totalCost.toFixed(5)} USD | Cache Ratio: ${(cacheRatio * 100).toFixed(1)}%`);

                    // Circuit Breaker financial limits
                    if (totalCost >= costThreshold) {
                        const errMsg = `FINANCIAL_ABORT: Execution budget of $${costThreshold.toFixed(2)} exceeded. Current spend: $${totalCost.toFixed(4)}. Aborting run to protect resources.`;
                        logger.error(errMsg);
                        throw new Error(errMsg);
                    }
                }
            }

            // Cosine Similarity loop detection
            const currentThought = assistantContent;
            if (previousThought && currentThought) {
                const sim = getCosineSimilarity(previousThought, currentThought);
                logger.info(`Semantic cosine similarity calculated: ${sim.toFixed(4)}`);
                if (sim >= 0.92) {
                    const warningMsg = `SYSTEM SYSTEM WARNING: You are repeating your previous reasoning path. Your last action failed with a silent state conflict. Do not attempt the same tool configuration again. Choose a different diagnostic endpoint or execute a graceful exit.`;
                    logger.warn(`Semantic similarity threshold crossed (sim: ${sim.toFixed(4)}). Injecting loop warning.`);
                    state.messages.push(new HumanMessage(warningMsg));
                }
            }
            previousThought = currentThought;

            // Structured OpenTelemetry logging
            const spanId = `s_turn_${iteration}`;
            console.log(JSON.stringify({
                traceId,
                spanId,
                parentSpanId: parentSpanId || traceId,
                actor: "agent_worker_nodejs",
                sessionId: state.missionId,
                type: "llm_call",
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
            }, null, 2));

            if (pendingToolCall) {
                const tool = tools.find(t => t.name === pendingToolCall!.name);
                if (tool) {
                    logger.info(`Executing tool: ${pendingToolCall.name}`, { missionId: state.missionId });

                    // Broadcast tool call to UI
                    await this.emit(onPacket, 'tool_call', {
                        toolName: pendingToolCall.name,
                        toolInput: pendingToolCall.args
                    });

                    // Emit specialized packet if delegating sub-agent or updating todos
                    if (pendingToolCall.name === 'write_todos') {
                        await this.emit(onPacket, 'todo', {
                            todos: pendingToolCall.args.todos as any
                        });
                        state.tasks = pendingToolCall.args.todos as any[];
                    } else if (pendingToolCall.name === 'delegate_task') {
                        await this.emit(onPacket, 'subagent_call', {
                            subagent: {
                                name: pendingToolCall.args.agentName as string,
                                instruction: pendingToolCall.args.instruction as string,
                                status: 'calling'
                            }
                        });
                    } else if (pendingToolCall.name === 'write_file' || pendingToolCall.name === 'read_file') {
                        await this.emit(onPacket, 'file_operation', {
                            fileOp: {
                                operation: pendingToolCall.name === 'write_file' ? 'write' : 'read',
                                path: pendingToolCall.args.filename as string
                            }
                        });
                    }

                    // Validation Gate pre-check
                    let validationError: string | null = null;
                    if (pendingToolCall.name === 'write_file' && pendingToolCall.args.content) {
                        const filename = (pendingToolCall.args.filename || "file.txt") as string;
                        const check = validateContent(filename, pendingToolCall.args.content as string);
                        if (!check.valid) {
                            validationError = `Validation Gate Rejection: ${check.reason}. You are prohibited from writing files containing empty placeholders or syntax errors. Fix the code/content and write it.`;
                        }
                    }

                    let observation;
                    if (validationError) {
                        logger.warn(`Validation gate rejected tool call: ${pendingToolCall.name}`);
                        observation = {
                            status: 'error' as const,
                            summary: validationError,
                            error: 'VALIDATION_REJECTION'
                        };
                    } else {
                        // Execute tool with context parameter for sub-agents to access history if fork_context=true
                        observation = await tool.execute(pendingToolCall.args, {
                            parentMessages: state.messages
                        });
                    }

                    // 2. Dynamic Context Offloading Flow
                    let finalSummary = observation.summary;
                    const remainingRatio = 1 - (getHistoryTokens(state.messages) / MAX_CONTEXT_TOKENS);
                    // Shrink threshold as context fills up, range: 20000 chars down to 2000 chars
                    const dynamicOffloadThreshold = Math.max(2000, Math.floor(20000 * remainingRatio));
                    logger.info(`Dynamic offload threshold set to ${dynamicOffloadThreshold} characters (remaining ratio: ${(remainingRatio * 100).toFixed(1)}%)`);

                    if (finalSummary.length > dynamicOffloadThreshold) {
                        try {
                            const runtimeFilesRoot = PATHS.OFFLOAD_ROOT;
                            await mkdir(runtimeFilesRoot, { recursive: true });

                            const offloadFilename = `offload_${Date.now()}_${tool.name}.txt`;
                            const offloadPath = join(runtimeFilesRoot, offloadFilename);
                            await writeFile(offloadPath, finalSummary, 'utf-8');

                            // Truncate and replace inside model context window with preview
                            const lines = finalSummary.split('\n');
                            const previewLines = lines.slice(0, 10).join('\n');
                            finalSummary = `[Context Offloaded to sa-output/runtime/files/${offloadFilename} due to size limit. First 10 lines preview:]\n${previewLines}\n\n...[Full contents saved to disk]...`;

                            logger.info(`Context offloaded to ${offloadPath}`);
                            await this.emit(onPacket, 'file_operation', {
                                fileOp: {
                                    operation: 'offload',
                                    path: `sa-output/runtime/files/${offloadFilename}`,
                                    preview: previewLines
                                }
                            });
                        } catch (err: any) {
                            logger.error("Failed to offload context", err);
                        }
                    }

                    // Emit tool results
                    if (pendingToolCall.name === 'delegate_task') {
                        await this.emit(onPacket, 'subagent_result', {
                            subagent: {
                                name: pendingToolCall.args.agentName as string,
                                instruction: pendingToolCall.args.instruction as string,
                                result: observation.summary,
                                status: observation.status === 'success' ? 'completed' : 'failed'
                            }
                        });
                    }

                    // Build the message history for the next iteration
                    const toolCallId = `tool_${Date.now()}`;
                    state.messages.push(new AIMessage({
                        content: assistantContent,
                        tool_calls: [{
                            id: toolCallId,
                            name: pendingToolCall.name,
                            args: pendingToolCall.args,
                            type: "tool_call"
                        }]
                    }));
                    state.messages.push(new ToolMessage({
                        tool_call_id: toolCallId,
                        content: finalSummary
                    }));

                    // Send observation to UI
                    await this.emit(onPacket, 'tool_result', {
                        toolName: pendingToolCall.name,
                        content: finalSummary
                    });

                } else {
                    logger.warn(`Tool not found: ${pendingToolCall.name}`, { missionId: state.missionId });
                    isComplete = true;
                }
            } else {
                state.messages.push(new AIMessage(assistantContent));
                isComplete = true;
            }

            // Save durable checkpoint state
            await this.saveState(state);
        }

        if (iteration >= maxIterations) {
            logger.warn(`Max iterations reached`, { missionId: state.missionId });
        }
    }
}


