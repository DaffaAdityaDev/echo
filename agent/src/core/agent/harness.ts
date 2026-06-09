import { HumanMessage, AIMessage, ToolMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { LLMProvider, AgentState, AgentStrategy, ToolDefinition, HarnessPacket, AgentPacketType } from '../../shared/types';
import { toolRegistry } from './tools/registry';
import { logger } from '../../shared/utils/logger';
import { DelegationTool } from './tools/definitions/delegation';
import { PATHS } from '../../shared/constants';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getCosineSimilarity, getHistoryTokens, validateContent } from '../../utils/harness';
import { ENV } from '../../config/env';
import { stateStorage } from './storage/factory';
import { ToolRetriever } from './services/retriever';


function calculateUsageCost(
    modelName: string,
    baseURL: string,
    promptTokens: number,
    completionTokens: number,
    cachedTokens: number
): { stepCost: number; cacheRatio: number } {
    const lowerURL = baseURL.toLowerCase();
    const cacheRatio = promptTokens > 0 ? (cachedTokens / promptTokens) : 0;
    // Local / Self-hosted models cost $0.00
    if (
        lowerURL.includes("localhost") || 
        lowerURL.includes("127.0.0.1") || 
        lowerURL.includes("lm-studio") || 
        lowerURL.includes("local") ||
        lowerURL.includes("192.168.") ||
        lowerURL.includes("10.")
    ) {
        return { stepCost: 0, cacheRatio };
    }

    const model = modelName.toLowerCase();
    let inputRate = 1.50; // per million tokens
    let outputRate = 6.00; // per million tokens
    let cacheReadRate = 0.75; // per million tokens

    if (model.includes("gpt-4o-mini")) {
        inputRate = 0.15;
        outputRate = 0.60;
        cacheReadRate = 0.075;
    } else if (model.includes("gpt-4o")) {
        inputRate = 2.50;
        outputRate = 10.00;
        cacheReadRate = 1.25;
    } else if (model.includes("claude-3-5-sonnet")) {
        inputRate = 3.00;
        outputRate = 15.00;
        cacheReadRate = 0.30;
    }

    const nonCached = Math.max(0, promptTokens - cachedTokens);
    const stepCost = ((nonCached * inputRate) + (cachedTokens * cacheReadRate) + (completionTokens * outputRate)) / 1000000;

    return { stepCost, cacheRatio };
}

export interface HarnessConfig {
    provider: LLMProvider;
    strategy: AgentStrategy;
    missionId?: string;
    tenantId?: string;
}

export class AgentHarness {
    private provider: LLMProvider;
    private strategy: AgentStrategy;
    private missionId: string;
    private tenantId: string;
    private static toolRetriever: ToolRetriever | null = null;
    private delegationTool: ToolDefinition;

    constructor(options: HarnessConfig) {
        this.provider = options.provider;
        this.strategy = options.strategy;
        this.missionId = options.missionId || crypto.randomUUID();
        this.tenantId = options.tenantId || "local";
        if (!AgentHarness.toolRetriever) {
            AgentHarness.toolRetriever = new ToolRetriever(toolRegistry.getAllTools());
        }
        this.delegationTool = new DelegationTool(this.provider).getToolDefinition();
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

    private queueDebugLog(filePath: string, content: string) {
        setImmediate(async () => {
            try {
                const dir = join(filePath, '..');
                await mkdir(dir, { recursive: true });
                await appendFile(filePath, content, 'utf-8');
            } catch (err) {
                logger.error("Background logging failed", err);
            }
        });
    }

    private async checkStuckState(objective: string, assistantContent: string): Promise<boolean> {
        try {
            const systemPrompt = "You are a state classifier. Respond with exactly 'COMPLETE' or 'STUCK'.";
            const userPrompt = `Analyze the Assistant's last response and the User's objective.
Determine if the Assistant has provided a direct response/final answer/greeting/clarification to the human user, OR if the Assistant has halted in a thinking/planning state (e.g. stating "I should search", "I need to find", "Let me check" without actually doing it or giving the final answer).

User Objective: "${objective}"
Assistant Response: "${assistantContent}"

Respond with exactly one of these two labels: "COMPLETE" or "STUCK".`;

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

        await this.emit(onPacket, 'metadata', {
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

        const allPhysicalTools = toolRegistry.getAllTools();

        // Get relevant tools using pre-indexed retriever (Smell 1)
        const relevantTools = AgentHarness.toolRetriever!.getRelevantTools(state.objective, allPhysicalTools, 4);

        // Ensure delegation tool is always included
        const tools = [...relevantTools];
        if (!tools.some(t => t.name === 'delegate_task')) {
            tools.push(this.delegationTool);
        }
        
        // Optimasi pencarian tool dari O(T) ke O(1) menggunakan Map Lookup table
        const toolMap = new Map<string, ToolDefinition>(tools.map(t => [t.name, t]));
        
        const systemPrompt = this.strategy.buildSystemPrompt(state, tools);

        await this.emit(onPacket, 'metadata', {
            meta: {
                missionId: state.missionId,
                strategy: this.strategy.name,
                historyDepth: state.messages.length,
                toolsAvailable: tools.map(t => t.name),
                objective: state.objective,
            }
        }, state.tasks.length);

        let isComplete = false;
        let iteration = state.tasks.length;
        const maxIterations = 15;
        const maxContextTokens = this.provider.maxContextTokens || 8192;

        let totalCost = 0;
        let cachedTokensSum = 0;
        let totalInputTokensSum = 0;
        const costThreshold = 1.00;
        let previousThought = "";

        while (!isComplete && iteration < maxIterations) {
            iteration++;
            logger.info(`Agent iteration ${iteration}`, { missionId: state.missionId });

            if (iteration > 8) {
                logger.warn(`Cognitive pacing threshold crossed (iteration: ${iteration}). Injecting pacing guideline.`);
                const pacingWarning = `[SYSTEM PACING WARNING]: You have taken ${iteration} turns. Please analyze if you are stuck in a loop. Adjust your plan, summarize what works, and move towards final synthesis to preserve execution budget.`;
                state.messages.push(new HumanMessage(pacingWarning));
            }

            // OPTIMASI 1: Ambil token history sekali saja di awal turn
            let currentTokens = getHistoryTokens(state.messages);
            let tokenUsageRatio = currentTokens / maxContextTokens;
            logger.info(`Current estimated context usage: ${currentTokens}/${maxContextTokens} tokens (${(tokenUsageRatio * 100).toFixed(1)}%)`);

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

                    state.messages = [
                        new HumanMessage(state.objective),
                        new AIMessage(`[Context Compaction Structured State Summary of Steps 1-${iteration - 1}]:\n${summaryText}`)
                    ];

                    currentTokens = getHistoryTokens(state.messages);

                    logger.info("Context compaction successfully applied.");
                    await this.emit(onPacket, 'reasoning', {
                        content: `*[System: Context compacted. Accumulated history of ${currentTokens} tokens summarized into structured high-density state to avoid context window bloating.]*`
                    }, iteration);
                } catch (err: any) {
                    logger.error("Context compaction failed", err);
                }
            }

            // ==================== PROMPT DEBUG GATES ====================
            if (ENV.DEBUG_PROMPT || ENV.NODE_ENV === 'development') {
                try {
                    const debugDir = join(process.cwd(), 'debug');
                    const today = new Date().toISOString().split('T')[0];
                    const debugPath = join(debugDir, `agent_history_debug_${today}.md`);
                    const purePath = join(debugDir, `agent_history_pure_${today}.md`);

                    const now = new Date();
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const ms = String(now.getMilliseconds()).padStart(3, '0');
                    const timeString = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${ms}`;

                    const shortMissionId = state.missionId.slice(0, 8);

                    const sampleMsg = state.messages[0];
                    const isLangChainInstance = sampleMsg && typeof sampleMsg._getType === 'function';
                    const storageStatus = isLangChainInstance ? "✅ HEALTHY" : "❌ OBJECT_CORRUPT";

                    const mdContent = [
                        `\n\n`,
                        `================================================================================`,
                        `## 🕒 [${timeString}] | MID: #_${shortMissionId}_ | ITERATION: ${iteration}`,
                        `### 🤖 ROLE: ${this.strategy.name.toUpperCase()}`,
                        `================================================================================`,
                        `### 🗄️ MONITORING GATES`,
                        `- **Storage Engine:** \`${ENV.STATE_BACKEND.toUpperCase()}\` [${storageStatus}]`,
                        `- **Context Memory Depth:** \`${state.messages.length} messages\``,
                        `---`,
                        `### 🛑 COMPRESSED XML SYSTEM PROMPT (Sent to LLM)`,
                        `\`\`\`xml\n${systemPrompt}\n\`\`\``,
                        `\n`,
                        `### 📥 KRONOLOGI CONTEXT HISTORY (Injected Visual Emojis)`,
                        state.messages.map((m, idx) => {
                            const rawType = m._getType ? m._getType().toUpperCase() : 'UNKNOWN';
                            
                            let badge = '⚪ UNKNOWN';
                            if (rawType === 'HUMAN') badge = '🟢 HUMAN';
                            if (rawType === 'AI') badge = '🤖 AI_THOUGHT';
                            if (rawType === 'TOOL') badge = '⚙️ TOOL_OBSERVATION';

                            return `**[MsgID: ${idx}] ${badge}:**\n${m.content}\n`;
                        }).join('\n---\n'),
                    ].join('\n');

                    const pureContent = [
                        `\n\n`,
                        `================================================================================`,
                        `ITERATION: ${iteration} | MID: ${shortMissionId} | TIME: ${timeString}`,
                        `================================================================================`,
                        `SYSTEM PROMPT:`,
                        systemPrompt,
                        `\n---`,
                        `MESSAGES:`,
                        state.messages.map((m, idx) => {
                            const rawType = m._getType ? m._getType() : 'unknown';
                            return `[Message ${idx}] [${rawType}]:\n${m.content}`;
                        }).join('\n\n'),
                        `\n`
                    ].join('\n');

                    // Non-blocking background log writers (Smell 2)
                    this.queueDebugLog(debugPath, mdContent);
                    this.queueDebugLog(purePath, pureContent);
                    logger.info(`📝 Prompt debug operations queued in background`);
                } catch (debugErr) {
                    logger.error("Failed to write token-optimized debug ledgers", debugErr);
                }

                // Kirim packet debug_prompt ke Frontend Canvas
                try {
                    await this.emit(onPacket, 'debug', {
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
            let pendingToolCall: { name: string; args: Record<string, unknown> } | null = null;

            for await (const event of eventStream) {
                if (event.reasoning) {
                    assistantContent += event.reasoning;
                    await this.emit(onPacket, 'reasoning', { content: event.reasoning }, iteration);
                }
                if (event.content) assistantContent += event.content;
                if (event.toolCall) pendingToolCall = event.toolCall;

                if (event.content && !pendingToolCall) {
                    await this.emit(onPacket, 'content', { content: event.content }, iteration);
                }
                if (event.usage) {
                    await this.emit(onPacket, 'usage', { meta: event.usage as any }, iteration);

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
                        const errMsg = `FINANCIAL_ABORT: Execution budget of $${costThreshold.toFixed(2)} exceeded. Current spend: $${totalCost.toFixed(4)}. Aborting run to protect resources.`;
                        logger.error(errMsg);
                        throw new Error(errMsg);
                    }
                }
            }

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

            const spanId = `s_turn_${iteration}`;
            logger.telemetry("llm_call", {
                traceId,
                spanId,
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

                    await this.emit(onPacket, 'tool_call', {
                        toolName: pendingToolCall.name,
                        toolInput: pendingToolCall.args
                    }, iteration);

                    if (pendingToolCall.name === 'write_todos') {
                        await this.emit(onPacket, 'todo', {
                            todos: pendingToolCall.args.todos as any
                        }, iteration);
                        state.tasks = pendingToolCall.args.todos as any[];
                    } else if (pendingToolCall.name === 'delegate_task') {
                        await this.emit(onPacket, 'subagent_call', {
                            subagent: {
                                name: pendingToolCall.args.agentName as string,
                                instruction: pendingToolCall.args.instruction as string,
                                status: 'calling'
                            }
                        }, iteration);
                    } else if (pendingToolCall.name === 'write_file' || pendingToolCall.name === 'read_file') {
                        await this.emit(onPacket, 'file_operation', {
                            fileOp: {
                                operation: pendingToolCall.name === 'write_file' ? 'write' : 'read',
                                path: pendingToolCall.args.filename as string
                            }
                        }, iteration);
                    }

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
                        // Pass onPacket as a streamRelay callback to prevent sub-agent streaming freeze (Smell 4)
                        observation = await tool.execute(pendingToolCall.args, {
                            parentMessages: state.messages,
                            onPacket
                        });
                    }

                    let finalSummary = observation.summary;
                    const remainingRatio = 1 - (currentTokens / maxContextTokens);
                    const dynamicOffloadThreshold = Math.max(2000, Math.floor(20000 * remainingRatio));
                    logger.info(`Dynamic offload threshold set to ${dynamicOffloadThreshold} characters (remaining ratio: ${(remainingRatio * 100).toFixed(1)}%)`);

                    if (finalSummary.length > dynamicOffloadThreshold) {
                        try {
                            const runtimeFilesRoot = PATHS.OFFLOAD_ROOT;
                            await mkdir(runtimeFilesRoot, { recursive: true });

                            const offloadFilename = `offload_${Date.now()}_${tool.name}.txt`;
                            const offloadPath = join(runtimeFilesRoot, offloadFilename);
                            await writeFile(offloadPath, finalSummary, 'utf-8');

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
                            }, iteration);
                        } catch (err: any) {
                            logger.error("Failed to offload context", err);
                        }
                    }

                    if (pendingToolCall.name === 'delegate_task') {
                        await this.emit(onPacket, 'subagent_result', {
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
                        }]
                    }));
                    state.messages.push(new ToolMessage({
                        tool_call_id: toolCallId,
                        content: finalSummary
                    }));

                    await this.emit(onPacket, 'tool_result', {
                        toolName: pendingToolCall.name,
                        content: finalSummary
                    }, iteration);

                } else {
                    logger.warn(`Tool not found: ${pendingToolCall.name}`, { missionId: state.missionId });
                    isComplete = true;
                }

            } else if (assistantContent.includes('<tool_call>') || assistantContent.includes('</tool_call>')) {
                // 2. TIER 1 AUTO-RECOVER: Soft Recovery (Format Tolerance)
                // Kasus: Model menulis XML teks mentah karena native binding terlewat
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

                    // Suntikkan kembali objek yang berhasil diselamatkan ke pool eksekusi di turn berikutnya
                    pendingToolCall = { name: toolName, args };
                    logger.info(`[NLAH RECOVER] Successfully extracted tool: ${toolName}. Retrying loop.`);
                    
                    state.messages.push(new AIMessage(assistantContent));
                    state.messages.push(new ToolMessage({ 
                        tool_call_id: `fallback_${Date.now()}`, 
                        content: `[Harness Notice]: Tool execution automatically re-routed via Soft Recovery.` 
                    }));
                } else {
                    // Jika ada tag XML tapi gagal di-parse oleh regex, lempar ke Tier 2
                    logger.error(`[NLAH RECOVER] XML detected but unparseable. Escalating to Tier 2.`);
                    const recoveryPrompt = `[HARNESS SYSTEM ERROR]: You attempted to call a tool using raw XML tags but the parameters were malformed. Please use the strict native tool call protocol or fix your XML block format immediately. Do not chat, execute the tool.`;
                    state.messages.push(new HumanMessage(recoveryPrompt));
                }

            } else {
                // 3. TIER 2 AUTO-RECOVER: Feedback Recovery (Anti-Stuck Check)
                // Kasus: Model berhenti tanpa manggil tool tapi tujuan objektif belum beres
                const looksLikeThinking = await this.checkStuckState(state.objective, assistantContent);
                
                if (looksLikeThinking && iteration < maxIterations) {
                    logger.warn(`[NLAH RECOVER] Tier 2 Feedback Recovery triggered. Agent halted in thinking state.`);
                    const feedbackPrompt = `[HARNESS SYSTEM NOTICE]: You are currently halting in a thought state without triggering an action. If you need external data, you MUST call an available tool now. If you have completed the task, output your FINAL ANSWER immediately.`;
                    
                    state.messages.push(new AIMessage(assistantContent));
                    state.messages.push(new HumanMessage(feedbackPrompt));
                } else {
                    // KONDISI AMAN: Model beneran ngasih jawaban final, baru kita exit loop
                    state.messages.push(new AIMessage(assistantContent));
                    isComplete = true;
                }
            }
            
            // Save state checkpoint at the end of each iteration/turn
            await stateStorage.set(state.missionId, state);
        }

        if (iteration >= maxIterations) {
            logger.warn(`Max iterations reached`, { missionId: state.missionId });
        }

        // Final state save
        await stateStorage.set(state.missionId, state);
    }
}