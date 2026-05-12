import { HumanMessage, AIMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";
import { LLMProvider, AgentState, AgentStrategy, ToolDefinition } from '../types';
import { toolRegistry } from '../tools/registry';
import { logger } from '../../shared/utils/logger';

export interface HarnessOptions {
    provider: LLMProvider;
    strategy: AgentStrategy;
}

/**
 * Typed packet protocol — the frontend reacts to `type` to render correctly.
 * 
 * content    → final reply text, shown in chat bubble
 * reasoning  → internal thinking, shown inside Thought Process accordion
 * tool_call  → agent is about to use a tool, shown inside Thought Process
 * tool_result→ tool response, shown inside Thought Process
 */
type PacketType = 'content' | 'reasoning' | 'tool_call' | 'tool_result' | 'metadata' | 'usage';

interface HarnessPacket {
    type: PacketType;
    content?: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
    meta?: Record<string, unknown>;
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

    async runMission(
        message: string,
        history: BaseMessage[],
        onPacket: (packet: any) => Promise<void>
    ) {
        const state: AgentState = {
            missionId: crypto.randomUUID(),
            objective: message,
            tasks: [],
            memory: {},
            // Prepend conversation history so the model has full context
            messages: [...history, new HumanMessage(message)]
        };

        const tools = toolRegistry.getAllTools();
        const systemPrompt = this.strategy.buildSystemPrompt(state, tools);

        // Emit metadata packet so the frontend/user knows what context is active
        await this.emit(onPacket, 'metadata', {
            meta: {
                strategy: this.strategy.name,
                historyDepth: history.length,
                toolsAvailable: tools.map(t => t.name),
                objective: message,
            }
        });

        let isComplete = false;
        let iteration = 0;
        const maxIterations = 10;

        while (!isComplete && iteration < maxIterations) {
            iteration++;
            logger.info(`Agent iteration ${iteration}`, { missionId: state.missionId });

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
                }
            }

            if (pendingToolCall) {
                const tool = toolRegistry.getTool(pendingToolCall.name);
                if (tool) {
                    logger.info(`Executing tool: ${pendingToolCall.name}`, { missionId: state.missionId });

                    // Tell the frontend: "agent is calling this tool" — goes into Thought Process
                    await this.emit(onPacket, 'tool_call', {
                        toolName: pendingToolCall.name,
                        toolInput: pendingToolCall.args
                    });

                    const observation = await tool.execute(pendingToolCall.args);

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
                        content: observation.summary
                    }));

                    // Tell the frontend: "here's what the tool returned" — goes into Thought Process
                    await this.emit(onPacket, 'tool_result', {
                        toolName: pendingToolCall.name,
                        content: observation.summary
                    });

                    // Loop continues — model will reason about the result next iteration

                } else {
                    logger.warn(`Tool not found: ${pendingToolCall.name}`, { missionId: state.missionId });
                    isComplete = true;
                }
            } else {
                state.messages.push(new AIMessage(assistantContent));
                isComplete = true;
            }
        }

        if (iteration >= maxIterations) {
            logger.warn(`Max iterations reached`, { missionId: state.missionId });
        }
    }
}
