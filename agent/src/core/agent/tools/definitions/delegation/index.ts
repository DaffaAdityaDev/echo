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
        config?: { parentMessages?: BaseMessage[]; onPacket?: (p: any) => Promise<void>; provider?: LLMProvider }
    ): Promise<Observation> => {
        try {
            const provider = config?.provider;
            if (!provider) {
                throw new Error("LLMProvider is required for delegation");
            }

            logger.info(DELEGATION_DEFAULTS.LOG_INFO_START(input.agentName), { fork_context: input.fork_context });

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

            const childMissionId = crypto.randomUUID();
            const childHarness = new AgentHarness({
                provider,
                strategy: subagentStrategy,
                missionId: childMissionId,
                tenantId: DELEGATION_DEFAULTS.TENANT_ID
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
                    } else if (packet.type === PACKET_TYPES.TOOL_CALL) {
                        stepLogs.push(DELEGATION_DEFAULTS.LOG_ACTION_PREFIX(packet.toolName, packet.toolInput));
                    } else if (packet.type === PACKET_TYPES.TOOL_RESULT) {
                        stepLogs.push(DELEGATION_DEFAULTS.LOG_OBSERVATION_PREFIX(packet.content));
                    } else if (packet.type === PACKET_TYPES.CONTENT && packet.content) {
                        subAgentOutput += packet.content;
                    }

                    // Relay sub-agent streaming packets to parent stream callback to prevent freeze
                    if (config?.onPacket) {
                        await config.onPacket(packet);
                    }
                }
            );

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
