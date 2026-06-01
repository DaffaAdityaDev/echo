import { z } from 'zod';
import { ToolDefinition, Observation, LLMProvider } from '../../types';
import { logger } from '../../../../shared/utils/logger';
import { HumanMessage, BaseMessage } from '@langchain/core/messages';
import { AgentHarness } from '../../core/harness';
import { ReActStrategy } from '../../strategies/re-act';

// Let's hold a static reference or factory for the provider and strategy of the subagent.
// We can pass the active provider and subagent details when executing.
export class DelegationTool {
    private provider: LLMProvider;

    constructor(provider: LLMProvider) {
        this.provider = provider;
    }

    getToolDefinition(): ToolDefinition {
        return {
            name: 'delegate_task',
            description: 'Delegate a specific sub-task or research query to a specialized child/sub-agent. This isolates the parent workspace and keeps the context window clean.',
            schema: z.object({
                agentName: z.string().describe('Name of the sub-agent (e.g. researcher-agent)'),
                instruction: z.string().describe('The task or query for the sub-agent to solve'),
                systemPrompt: z.string().describe('The persona, role, or guidelines for the sub-agent'),
                fork_context: z.boolean().default(false).describe('If true, inherits parent message history. If false, starts with a clean memory/context.')
            }),
            execute: async (input: { agentName: string; instruction: string; systemPrompt: string; fork_context: boolean }, config?: any): Promise<Observation> => {
                try {
                    logger.info(`Delegating task to sub-agent [${input.agentName}]`, { fork_context: input.fork_context });

                    // Reconstruct history if fork_context is true
                    let historyMessages: BaseMessage[] = [];
                    if (input.fork_context && config?.parentMessages) {
                        historyMessages = config.parentMessages;
                    }

                    // Create sub-agent strategy using custom prompt
                    const subagentStrategy = {
                        name: 'subagent',
                        buildSystemPrompt: () => input.systemPrompt
                    };

                    const childHarness = new AgentHarness({
                        provider: this.provider,
                        strategy: subagentStrategy
                    });

                    let subAgentOutput = "";
                    let stepLogs: string[] = [];

                    // Run the child harness
                    await childHarness.runMission(
                        input.instruction,
                        historyMessages,
                        async (packet: any) => {
                            // Collect reasoning and content from child
                            if (packet.type === 'reasoning' && packet.content) {
                                stepLogs.push(`[Reasoning] ${packet.content}`);
                            } else if (packet.type === 'tool_call') {
                                stepLogs.push(`[Action] Called tool ${packet.toolName} with input ${JSON.stringify(packet.toolInput)}`);
                            } else if (packet.type === 'tool_result') {
                                stepLogs.push(`[Observation] Tool returned: ${packet.content}`);
                            } else if (packet.type === 'content' && packet.content) {
                                subAgentOutput += packet.content;
                            }
                        }
                    );

                    return {
                        status: 'success',
                        summary: `Sub-agent [${input.agentName}] completed task.\n\nResult:\n${subAgentOutput}`,
                        data: {
                            agentName: input.agentName,
                            result: subAgentOutput,
                            logs: stepLogs
                        }
                    };
                } catch (error: any) {
                    logger.error(`Sub-agent delegation to [${input.agentName}] failed`, error);
                    return {
                        status: 'error',
                        summary: `Sub-agent [${input.agentName}] failed to execute task: ${error.message}`,
                        error: error.message
                    };
                }
            }
        };
    }
}

// We will register this tool inside our AgentHarness dynamic execution flow.
