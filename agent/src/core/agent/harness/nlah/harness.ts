import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { LLMProvider, AgentState, AgentStrategy, ToolDefinition, HarnessPacket, AgentPacketType, AgentStatus } from '../../../../shared/types';
import { toolRegistry } from '../../tools/registry';
import { StrategyFactory } from '../../strategies/factory';
import { CircuitBreaker } from './circuit_breaker';
import { DegradationManager, DegradationLevel } from './degradation';
import { compressObservation } from './utils/compress';
import { AgentStatusTracker } from './utils/status_tracker';
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
import { SkillRegistry } from '../../skills';
import { HARNESS_PROMPTS } from "./prompts";
import { calculateUsageCost } from "../../../../infrastructure/providers/utils";
import { queuePromptDebug } from "./utils/debug";
import { HarnessConfig } from '../types';
import { cancellationManager } from '../cancel_manager';

export class NlahHarness {
    private provider: LLMProvider;
    private strategy: AgentStrategy;
    private missionId: string;
    private tenantId: string;
    private explicitTools?: ToolDefinition[];
    private skills?: string[];
    private compressionEnabled = true;
    private pacingEnabled = true;
    private pacingForced = false;
    private loopDetectionEnabled = true;
    private harnessConfig?: any;
    private statusTracker?: AgentStatusTracker;
    private static toolRetriever: ToolRetriever | null = null;
    private static skillRegistry = SkillRegistry.getInstance();

    constructor(options: HarnessConfig) {
        this.provider = options.provider;
        this.strategy = options.strategy;
        this.missionId = options.missionId || crypto.randomUUID();
        this.tenantId = options.tenantId || HARNESS_CONFIG.DEFAULT_TENANT_ID;
        this.explicitTools = options.tools;
        this.skills = options.skills;
        this.harnessConfig = options.harnessConfig;

        if (!NlahHarness.toolRetriever) {
            NlahHarness.toolRetriever = new ToolRetriever(toolRegistry.getAllTools());
        }
    }

    private async emit(onPacket: (p: any) => Promise<void>, type: AgentPacketType, payload: Partial<HarnessPacket>, step: number) {
        const agentStatus = this.statusTracker ? this.statusTracker.getStatus() : undefined;
        await onPacket({ 
            type, 
            missionId: this.missionId,
            step,
            timestamp: Date.now(),
            ...payload,
            ...(agentStatus ? { agentStatus } : {})
        });
    }

    private async updateStatus(onPacket: (p: any) => Promise<void>, updates: Partial<AgentStatus>, step: number) {
        if (!this.statusTracker) return;
        const { changed, from, to } = this.statusTracker.update(updates);
        if (changed) {
            let reason = 'transition';
            if (to === 'degraded') {
                reason = 'consecutive_tool_failures';
            } else if (to === 'looping') {
                reason = 'cosine_similarity_threshold';
            }
            await this.emit(onPacket, 'state_change', {
                meta: { from, to, reason }
            } as any, step);
        }
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

    private async setupMissionParams(
        state: AgentState,
        traceparent?: string
    ) {
        const traceId = crypto.randomUUID().replace(/-/g, "");
        let parentSpanId = "";
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
        const isSubAgent = this.tenantId === HARNESS_CONFIG.SUBAGENT_TENANT_ID;

        let filteredFullPool = fullToolPool;
        if (isSubAgent) {
            filteredFullPool = fullToolPool.filter(t => t.name !== 'delegate_task');
        }

        let tools: ToolDefinition[];
        if (this.explicitTools !== undefined) {
            tools = isSubAgent
                ? this.explicitTools.filter(t => t.name !== 'delegate_task')
                : this.explicitTools;
        } else {
            tools = NlahHarness.toolRetriever!.getRelevantTools(state.objective, filteredFullPool);
        }

        if (this.skills?.length) {
            const allowed = NlahHarness.skillRegistry.getToolFilter(this.skills);
            if (allowed) tools = tools.filter(t => allowed.includes(t.name));
        }

        return { tools, toolMap: new Map(tools.map(t => [t.name, t])) };
    }

    private buildSystemPrompt(state: AgentState, tools: ToolDefinition[]): string {
        let systemPrompt = this.strategy.buildSystemPrompt(state, tools);
        if (this.skills?.length) {
            const skillPrompts = NlahHarness.skillRegistry.compileSkillPrompts(this.skills);
            const modifiers = NlahHarness.skillRegistry.compileModifiers(this.skills);
            systemPrompt += '\n\n' + skillPrompts;
            if (modifiers.compression === false) this.compressionEnabled = false;
            if (modifiers.pacing === false) this.pacingEnabled = false;
            if (modifiers.loopDetection === false) this.loopDetectionEnabled = false;
        }
        return systemPrompt;
    }

    private async checkCancellation(iteration: number, onPacket: (p: any) => Promise<void>): Promise<boolean> {
        if (cancellationManager.isAborted(this.missionId)) {
            logger.info(`NlahHarness: Mission ${this.missionId} cancelled, aborting harness run.`);
            await this.emit(onPacket, PACKET_TYPES.METADATA, { content: `Mission execution cancelled.` }, iteration);
            return true;
        }
        return false;
    }

    private async handleDegradation(
        state: AgentState,
        degradation: DegradationManager,
        lastDegradationLevel: DegradationLevel,
        iteration: number,
        onPacket: (p: any) => Promise<void>
    ): Promise<{ systemPrompt: string; toolMap: Map<string, ToolDefinition>; lastDegradationLevel: DegradationLevel }> {
        const currentLevel = degradation.getLevel();
        if (currentLevel === lastDegradationLevel) {
            return { systemPrompt: '', toolMap: new Map(), lastDegradationLevel };
        }

        const fromStr = lastDegradationLevel === 'normal' ? 'nlah' : 'restricted';
        const toStr = currentLevel === 'restricted' ? 'restricted' : 'standard';
        const reasonStr = currentLevel === 'restricted' ? 'circuit_breakers_open' : 'consecutive_tool_failures';

        await this.emit(onPacket, 'degraded', { meta: { from: fromStr, to: toStr, reason: reasonStr } }, iteration);

        let systemPrompt = '';
        let toolMap = new Map<string, ToolDefinition>();

        if (currentLevel === 'restricted') {
            state.messages.push(new HumanMessage("System: tool execution errors detected. Continuing with knowledge only."));
            systemPrompt = this.strategy.buildSystemPrompt(state, []);
        } else if (currentLevel === 'standard') {
            state.messages.push(new HumanMessage("System: switching to direct response."));
            this.strategy = StrategyFactory.create('standard');
            const anchor = state.messages[0];
            const lastUserMsg = [...state.messages].reverse().find(m => m._getType() === 'human');
            state.messages = lastUserMsg ? [anchor, lastUserMsg] : [anchor];
            systemPrompt = this.strategy.buildSystemPrompt(state, []);
        }

        return { systemPrompt, toolMap, lastDegradationLevel: currentLevel };
    }

    private async handleCompaction(
        state: AgentState,
        iteration: number,
        onPacket: (p: any) => Promise<void>
    ): Promise<void> {
        if (!this.compressionEnabled) return;
        const maxContextTokens = this.provider.maxContextTokens ?? HARNESS_CONFIG.DEFAULT_MAX_CONTEXT_TOKENS;
        let currentTokens = getHistoryTokens(state.messages);
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
            state.messages = [anchor, ...summaryMsg, ...droppedLastTurns];

            logger.info("Context compaction successfully applied.");
            await this.emit(onPacket, PACKET_TYPES.REASONING, {
                content: HARNESS_PROMPTS.LOG_COMPACTED(getHistoryTokens(state.messages))
            }, iteration);
        } catch (err: any) {
            logger.langfuse("ERROR", `Context compaction failed: ${err.message}`, { error: err.message });
        }
    }

    private async emitDebugPackets(state: AgentState, systemPrompt: string, iteration: number, onPacket: (p: any) => Promise<void>): Promise<void> {
        if (!ENV.DEBUG_PROMPT && ENV.NODE_ENV !== DEBUG_CONFIG.ENV) return;
        queuePromptDebug({ state, iteration, strategyName: this.strategy.name, systemPrompt });
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

    private async processStreamEvents(
        eventStream: AsyncIterable<any>,
        iteration: number,
        onPacket: (p: any) => Promise<void>
    ): Promise<{
        assistantContent: string;
        reasoningContent: string;
        pendingToolCall: { name: string; args: Record<string, unknown> } | null;
        hasContentEmitted: boolean;
    }> {
        let assistantContent = "";
        let reasoningContent = "";
        let pendingToolCall: { name: string; args: Record<string, unknown> } | null = null;
        let hasContentEmitted = false;
        let tokenEstimate = 0;
        const streamStart = Date.now();
        let lastChunkTime = Date.now();
        const heartbeatIntervalTime = this.harnessConfig?.agentStatus?.heartbeatInterval ?? HARNESS_CONFIG.AGENT_STATUS.HEARTBEAT_INTERVAL;

        const heartbeatInterval = setInterval(() => {
            if (Date.now() - lastChunkTime >= heartbeatIntervalTime) {
                this.emit(onPacket, 'heartbeat', {}, iteration).catch(() => {});
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
                        throughput: (Date.now() - streamStart) / 1000 > 0 ? tokenEstimate / ((Date.now() - streamStart) / 1000) : undefined
                    });
                    await this.emit(onPacket, PACKET_TYPES.REASONING, { content: event.reasoning }, iteration);
                }
                if (event.content) {
                    assistantContent += event.content;
                    tokenEstimate += Math.ceil(event.content.length / 4);
                    this.statusTracker?.update({
                        currentThought: (reasoningContent || assistantContent).substring(0, 50),
                        throughput: (Date.now() - streamStart) / 1000 > 0 ? tokenEstimate / ((Date.now() - streamStart) / 1000) : undefined
                    });
                }
                if (event.toolCall) pendingToolCall = event.toolCall;
                if (event.content && !pendingToolCall) {
                    hasContentEmitted = true;
                    await this.emit(onPacket, PACKET_TYPES.CONTENT, { content: event.content }, iteration);
                }
                if (event.usage) {
                    await this.emit(onPacket, PACKET_TYPES.USAGE, { meta: event.usage }, iteration);
                    const elapsed = (Date.now() - streamStart) / 1000;
                    this.statusTracker?.update({ throughput: elapsed > 0 ? (event.usage.completionTokens ?? 0) / elapsed : undefined });
                }
            }
        } finally {
            clearInterval(heartbeatInterval);
        }

        return { assistantContent, reasoningContent, pendingToolCall, hasContentEmitted };
    }

    private async executeToolCall(
        pendingToolCall: { name: string; args: Record<string, unknown> },
        toolMap: Map<string, ToolDefinition>,
        assistantContent: string,
        reasoningContent: string,
        iteration: number,
        onPacket: (p: any) => Promise<void>,
        state: AgentState,
        circuit: CircuitBreaker,
        degradation: DegradationManager,
        totalInputTokensSum: number,
        maxContextTokens: number
    ): Promise<{ isComplete: boolean }> {
        if (circuit.isOpen(pendingToolCall.name)) {
            logger.warn(`Circuit breaker is open for tool: ${pendingToolCall.name}, skipping execution.`, { missionId: state.missionId });
            await this.emit(onPacket, 'tool_skip', { toolName: pendingToolCall.name }, iteration);
            degradation.recordToolError();
            state.messages.push(new AIMessage(`Tool ${pendingToolCall.name} is currently unavailable due to repeated failures. It has been skipped.`));
            return { isComplete: false };
        }

        const tool = toolMap.get(pendingToolCall.name);
        if (!tool) {
            const reason = this.pacingForced ? 'pacing forced synthesis' : 'tool not in map';
            logger.warn(`Tool not found: ${pendingToolCall.name} (${reason})`, { missionId: state.missionId });
            state.messages.push(new AIMessage({
                content: assistantContent,
                additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined
            }));
            return { isComplete: false };
        }

        logger.info(`Executing tool: ${pendingToolCall.name}`, { missionId: state.missionId });
        this.statusTracker?.update({ currentTool: pendingToolCall.name });

        await this.emit(onPacket, PACKET_TYPES.TOOL_CALL, {
            toolName: pendingToolCall.name,
            toolInput: pendingToolCall.args
        }, iteration);

        if (pendingToolCall.name === 'write_todos') {
            await this.emit(onPacket, PACKET_TYPES.TODO, { todos: pendingToolCall.args.todos as any }, iteration);
            state.tasks = pendingToolCall.args.todos as any[];
        } else if (pendingToolCall.name === 'delegate_task') {
            await this.emit(onPacket, PACKET_TYPES.SUBAGENT_CALL, {
                subagent: { name: pendingToolCall.args.agentName as string, instruction: pendingToolCall.args.instruction as string, status: 'calling' }
            }, iteration);
        }

        let observation;
        try {
            observation = await tool.execute(pendingToolCall.args, {
                parentMessages: state.messages, onPacket, provider: this.provider, tools: [...toolMap.values()]
            });
        } catch (err: any) {
            logger.error(`Tool execution failed for ${pendingToolCall.name}: ${err.message}`, err);
            observation = { status: OPERATION_STATUS.ERROR, summary: `Tool execution failed: Failed to perform ${pendingToolCall.name}. Please try again later or refine the request.`, error: 'TOOL_EXECUTION_FAILED' };
        }

        const isError = observation.status === OPERATION_STATUS.ERROR;
        if (isError) {
            circuit.recordFailure(pendingToolCall.name);
            degradation.recordToolError();
            const failures = circuit.getState(pendingToolCall.name)?.failures ?? 1;
            const maxRetries = this.harnessConfig?.circuitBreaker?.maxRetriesPerTool ?? HARNESS_CONFIG.CIRCUIT_BREAKER.MAX_RETRIES_PER_TOOL;
            const isOpen = circuit.isOpen(pendingToolCall.name);
            observation = compressObservation(observation, failures, maxRetries, isOpen);
        } else {
            circuit.recordSuccess(pendingToolCall.name);
            degradation.reset();
        }

        if (pendingToolCall.name === 'delegate_task') {
            await this.emit(onPacket, PACKET_TYPES.SUBAGENT_RESULT, {
                subagent: { name: pendingToolCall.args.agentName as string, instruction: pendingToolCall.args.instruction as string, result: observation.summary, status: observation.status === 'success' ? 'completed' : 'failed' }
            }, iteration);
        }

        const toolCallId = `tool_${Date.now()}`;
        state.messages.push(new AIMessage({
            content: assistantContent,
            tool_calls: [{ id: toolCallId, name: pendingToolCall.name, args: pendingToolCall.args, type: "tool_call" }],
            additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined
        }));
        state.messages.push(new ToolMessage({ tool_call_id: toolCallId, content: observation.summary }));

        await this.emit(onPacket, PACKET_TYPES.TOOL_RESULT, {
            toolName: pendingToolCall.name, content: observation.summary, toolResult: observation.data
        }, iteration);

        await this.emit(onPacket, 'progress', { meta: { phase: 'tool_execution', tokensUsed: totalInputTokensSum, tokensTotal: maxContextTokens } } as any, iteration);
        this.statusTracker?.update({ currentTool: undefined });

        return { isComplete: false };
    }

    private async handleAutoRecovery(
        assistantContent: string,
        reasoningContent: string,
        iteration: number,
        onPacket: (p: any) => Promise<void>,
        state: AgentState
    ): Promise<{ isComplete: boolean; retryWithTool: { name: string; args: Record<string, unknown> } | null }> {
        if (assistantContent.includes('<tool_call>') || assistantContent.includes('</tool_call>')) {
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
                logger.info(`[NLAH RECOVER] Successfully extracted tool: ${toolName}. Retrying loop.`);
                state.messages.push(new AIMessage({ content: assistantContent, additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined }));
                state.messages.push(new ToolMessage({ tool_call_id: `fallback_${Date.now()}`, content: HARNESS_PROMPTS.LOG_RE_ROUTE }));
                return { isComplete: false, retryWithTool: { name: toolName, args } };
            } else {
                logger.error(`[NLAH RECOVER] XML detected but unparseable. Escalating to Tier 2.`);
                state.messages.push(new HumanMessage(HARNESS_PROMPTS.RECOVERY_PROMPT));
                return { isComplete: false, retryWithTool: null };
            }
        }

        const looksLikeThinking = await this.checkStuckState(state.objective, assistantContent);
        if (looksLikeThinking && iteration < HARNESS_CONFIG.MAX_ITERATIONS) {
            logger.warn(`[NLAH RECOVER] Tier 2 Feedback Recovery triggered. Agent halted in thinking state.`);
            state.messages.push(new AIMessage({ content: assistantContent, additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined }));
            state.messages.push(new HumanMessage(HARNESS_PROMPTS.FEEDBACK_PROMPT));
            return { isComplete: false, retryWithTool: null };
        }

        state.messages.push(new AIMessage({ content: assistantContent, additional_kwargs: reasoningContent ? { reasoning_content: reasoningContent } : undefined }));
        return { isComplete: true, retryWithTool: null };
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

        const { traceId, parentSpanId } = await this.setupMissionParams(state, traceparent);
        const trace = startAgentTrace(traceId, state.missionId, this.tenantId, this.strategy.name, state.objective);
        const { tools, toolMap } = this.selectTools(state);
        const systemPrompt = this.buildSystemPrompt(state, tools);

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

        const cbEnabled = this.harnessConfig?.circuitBreaker?.enabled ?? true;
        const circuit = new CircuitBreaker(cbEnabled ? { openAfter: this.harnessConfig?.circuitBreaker?.openAfter, maxRetriesPerTool: this.harnessConfig?.circuitBreaker?.maxRetriesPerTool } : { openAfter: Infinity, maxRetriesPerTool: Infinity });

        const degEnabled = this.harnessConfig?.degradation?.enabled ?? true;
        const degradation = new DegradationManager(degEnabled ? { degradeAfter: this.harnessConfig?.degradation?.degradeAfter, abortAfter: this.harnessConfig?.degradation?.abortAfter } : { degradeAfter: Infinity, abortAfter: Infinity });

        let lastDegradationLevel: DegradationLevel = 'normal';
        let currentSystemPrompt = systemPrompt;
        let currentToolMap = toolMap;

        this.statusTracker = new AgentStatusTracker(
            iteration,
            maxIterations,
            this.strategy.name === 'standard' ? 'standard' : 'agent'
        );
        await this.updateStatus(onPacket, { state: 'running' }, iteration);
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
            if (await this.checkCancellation(iteration, onPacket)) break;
            iteration++;

            let span: any = null;
            if (trace) {
                span = trace.startObservation(`turn-${iteration}`, {
                    input: { messagesCount: state.messages.length }
                }, { asType: "span" });
            }

            logger.info(`Agent iteration ${iteration}`, { missionId: state.missionId, traceId: trace?.traceId, spanId: span?.id });

            const executeTurn = async () => {
                await langfuseStorage.run({ trace, span, sessionId: state.missionId, userId: this.tenantId }, async () => {
                    try {
                        if (degradation.shouldAbort()) {
                            const errMsg = `ABORT: Execution failed due to ${degradation.getConsecutiveFailures()} consecutive tool errors.`;
                            logger.error(errMsg);
                            await this.updateStatus(onPacket, { state: 'aborted' }, iteration);
                            throw new Error(errMsg);
                        }

                        const result = await this.handleDegradation(state, degradation, lastDegradationLevel, iteration, onPacket);
                        if (result.systemPrompt) currentSystemPrompt = result.systemPrompt;
                        if (result.toolMap.size > 0 || result.lastDegradationLevel !== lastDegradationLevel) currentToolMap = result.toolMap;
                        lastDegradationLevel = result.lastDegradationLevel;

                        const currentLevel = degradation.getLevel();
                        const activeCircuitBreakers = circuit.getAllOpenCircuits();
                        const currentStrategyStr = this.strategy.name === 'standard' ? 'standard' : (currentLevel === 'restricted' ? 'restricted' : 'agent');
                        await this.updateStatus(onPacket, {
                            state: currentLevel !== 'normal' ? 'degraded' : 'running',
                            step: iteration,
                            strategy: currentStrategyStr,
                            activeCircuitBreakers,
                            consecutiveFailures: degradation.getConsecutiveFailures()
                        }, iteration);

                        if (this.pacingEnabled && iteration > HARNESS_CONFIG.PACING_THRESHOLD) {
                            logger.warn(`Cognitive pacing threshold crossed (iteration: ${iteration}). Injecting forced synthesis.`);
                            state.messages.push(new HumanMessage(HARNESS_PROMPTS.PACING_WARNING(iteration)));
                            this.pacingForced = true;
                            currentToolMap = new Map();
                        }

                        await this.handleCompaction(state, iteration, onPacket);
                        await this.emitDebugPackets(state, currentSystemPrompt, iteration, onPacket);

                        const activeTools = currentLevel !== 'normal' ? [] : tools;
                        const eventStream = this.provider.stream(state.messages, activeTools, currentSystemPrompt);

                        const { assistantContent, reasoningContent, pendingToolCall, hasContentEmitted } = await this.processStreamEvents(eventStream, iteration, onPacket);

                        if (previousThought && assistantContent) {
                            const sim = getCosineSimilarity(previousThought, assistantContent);
                            logger.info(`Semantic cosine similarity calculated: ${sim.toFixed(4)}`);
                            if (this.loopDetectionEnabled && sim >= HARNESS_CONFIG.SIMILARITY_THRESHOLD) {
                                logger.langfuse("WARN", `Semantic similarity threshold crossed (sim: ${sim.toFixed(4)}). Injecting loop warning.`);
                                state.messages.push(new HumanMessage(HARNESS_PROMPTS.REPEATING_WARNING));
                                await this.updateStatus(onPacket, { state: 'looping' }, iteration);
                            }
                        }
                        previousThought = assistantContent;

                        let toolCallResult: { name: string; args: Record<string, unknown> } | null = pendingToolCall;
                        if (toolCallResult) {
                            const { isComplete: turnComplete } = await this.executeToolCall(
                                toolCallResult, currentToolMap, assistantContent, reasoningContent,
                                iteration, onPacket, state, circuit, degradation, totalInputTokensSum, maxContextTokens
                            );
                            if (!toolCallResult && !hasContentEmitted && assistantContent) {
                                await this.emit(onPacket, PACKET_TYPES.CONTENT, { content: assistantContent }, iteration);
                            }
                        } else {
                            const { isComplete: turnComplete, retryWithTool } = await this.handleAutoRecovery(
                                assistantContent, reasoningContent, iteration, onPacket, state
                            );
                            isComplete = turnComplete;
                            if (retryWithTool) {
                                const retryResult = await this.executeToolCall(
                                    retryWithTool, currentToolMap, assistantContent, reasoningContent,
                                    iteration, onPacket, state, circuit, degradation, totalInputTokensSum, maxContextTokens
                                );
                            }
                            if (!isComplete && !hasContentEmitted && assistantContent) {
                                await this.emit(onPacket, PACKET_TYPES.CONTENT, { content: assistantContent }, iteration);
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
            await this.updateStatus(onPacket, { state: 'aborted' }, iteration);
        } else if (isComplete) {
            await this.updateStatus(onPacket, { state: 'completed' }, iteration);
        }

        await this.emit(onPacket, 'turn_complete', {
            meta: {
                completed: isComplete,
                totalIterations: iteration,
                totalCost
            }
        }, iteration);

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
