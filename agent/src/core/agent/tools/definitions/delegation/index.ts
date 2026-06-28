import { z } from 'zod';
import { ToolDefinition, Observation, LLMProvider } from '../../../../../shared/types';
import { logger } from '../../../../../shared/utils/logger';
import { HumanMessage, BaseMessage } from '@langchain/core/messages';
import { AgentHarness } from '../../../harness';
import { AnchorFactory } from '../../../anchors/factory';
import { 
    DELEGATION_CONFIG, 
    SCHEMA_DESC, 
    OPERATION_STATUS, 
    PACKET_TYPES, 
    DELEGATION_DEFAULTS 
} from './constants';
import { langfuseStorage } from '../../../../../utils/langfuse';


export const delegate_task: ToolDefinition = {
    name: DELEGATION_CONFIG.NAME,
    description: DELEGATION_CONFIG.DESCRIPTION,
    keywords: [...DELEGATION_CONFIG.KEYWORDS],
    schema: z.object({
        agentName: z.string().describe(SCHEMA_DESC.AGENT_NAME),
        instruction: z.string().describe(SCHEMA_DESC.INSTRUCTION),
        systemPrompt: z.string().describe(SCHEMA_DESC.SYSTEM_PROMPT),
        fork_context: z.boolean().default(false).describe(SCHEMA_DESC.FORK_CONTEXT)
    }),
    execute: async (
        input: { agentName: string; instruction: string; systemPrompt: string; fork_context: boolean }, 
        config?: { parentMessages?: BaseMessage[]; onPacket?: (p: any) => Promise<void>; provider?: LLMProvider; tools?: any[] }
    ): Promise<Observation> => {
        const store = langfuseStorage.getStore();
        const parentMissionId = store?.sessionId || "standalone";
        const childMissionId = crypto.randomUUID();

        try {
            const provider = config?.provider;
            if (!provider) {
                throw new Error("LLMProvider is required for delegation");
            }

            logger.agentActivity(parentMissionId, 'DELEGATE_START', `Delegating task to sub-agent "${input.agentName}": "${input.instruction}"`, {
                childMissionId,
                agentName: input.agentName,
                forkContext: input.fork_context
            });

            // Reconstruct history if fork_context is true
            let historyMessages: BaseMessage[] = [];
            if (input.fork_context && config?.parentMessages) {
                historyMessages = config.parentMessages;
            }

            // Create sub-agent strategy using custom prompt
            const subagentStrategy = {
                name: DELEGATION_DEFAULTS.STRATEGY_NAME,
                buildSystemPrompt: () => input.systemPrompt
            };

            const childHarness = new AgentHarness({
                provider,
                strategy: subagentStrategy,
                missionId: childMissionId,
                tenantId: DELEGATION_DEFAULTS.TENANT_ID,
                tools: config?.tools
            });

            // Build child hydrated state
            const childState = {
                missionId: childMissionId,
                objective: input.instruction,
                tasks: [],
                memory: {},
                messages: [
                    AnchorFactory.create().build(),
                    ...historyMessages,
                    new HumanMessage(input.instruction)
                ]
            };

            let subAgentOutput = "";
            let stepLogs: string[] = [];

            // Run the child harness with child hydrated state
            await childHarness.runMission(
                childState,
                async (packet: any) => {
                    // Collect reasoning and content from child
                    if (packet.type === PACKET_TYPES.REASONING && packet.content) {
                        stepLogs.push(`${DELEGATION_DEFAULTS.LOG_REASONING_PREFIX}${packet.content}`);
                        logger.agentActivity(parentMissionId, 'DELEGATE_REASONING', `[Sub-Agent ${input.agentName}] ${packet.content.trim()}`, { childMissionId });
                    } else if (packet.type === PACKET_TYPES.TOOL_CALL) {
                        stepLogs.push(DELEGATION_DEFAULTS.LOG_ACTION_PREFIX(packet.toolName, packet.toolInput));
                        logger.agentActivity(parentMissionId, 'DELEGATE_TOOL_CALL', `[Sub-Agent ${input.agentName}] Calling tool "${packet.toolName}"`, { childMissionId, toolName: packet.toolName, toolInput: packet.toolInput });
                    } else if (packet.type === PACKET_TYPES.TOOL_RESULT) {
                        stepLogs.push(DELEGATION_DEFAULTS.LOG_OBSERVATION_PREFIX(packet.content));
                        logger.agentActivity(parentMissionId, 'DELEGATE_TOOL_RESULT', `[Sub-Agent ${input.agentName}] Tool returned: ${packet.content.trim().slice(0, 100)}...`, { childMissionId });
                    } else if (packet.type === PACKET_TYPES.CONTENT && packet.content) {
                        subAgentOutput += packet.content;
                    }

                    // Relay sub-agent streaming packets to parent stream callback to prevent freeze
                    const RELAY_TYPES = new Set(['reasoning', 'content', 'tool_call', 'tool_result', 'swarm_status']);
                    if (config?.onPacket && RELAY_TYPES.has(packet.type)) {
                        await config.onPacket({
                            ...packet,
                            missionId: parentMissionId
                        });
                    }
                }
            );

            logger.agentActivity(parentMissionId, 'DELEGATE_COMPLETE', `Sub-agent "${input.agentName}" completed task. Output: "${subAgentOutput.trim().slice(0, 100)}..."`, { childMissionId, agentName: input.agentName });

            return {
                status: OPERATION_STATUS.SUCCESS,
                summary: DELEGATION_DEFAULTS.SUMMARY_SUCCESS(input.agentName, subAgentOutput),
                data: {
                    agentName: input.agentName,
                    result: subAgentOutput,
                    logs: stepLogs
                }
            };
        } catch (error: any) {
            logger.agentActivity(parentMissionId, 'DELEGATE_ERROR', `Sub-agent "${input.agentName}" failed: ${error.message}`, { childMissionId, error: error.message });
            logger.error(DELEGATION_DEFAULTS.LOG_ERROR_FAIL(input.agentName), error);
            return {
                status: OPERATION_STATUS.ERROR,
                summary: DELEGATION_DEFAULTS.SUMMARY_FAILURE(input.agentName, error.message),
                error: error.message
            };
        }

    }
};

export default delegate_task;
