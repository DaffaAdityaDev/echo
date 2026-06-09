import { HumanMessage, AIMessage, ToolMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { AgentState } from '../../../shared/types';

export function serializeAgentState(state: AgentState): any {
    return {
        ...state,
        messages: state.messages.map(msg => ({
            type: msg._getType(),
            content: msg.content,
            name: msg.name,
            id: msg.id,
            additional_kwargs: msg.additional_kwargs,
            response_metadata: msg.response_metadata,
            tool_call_id: (msg as any).tool_call_id,
            tool_calls: (msg as any).tool_calls,
        }))
    };
}

export function deserializeAgentState(serialized: any): AgentState {
    if (!serialized) return serialized;
    
    const messages = (serialized.messages || []).map((msg: any) => {
        switch (msg.type) {
            case 'human':
                return new HumanMessage({
                    content: msg.content,
                    name: msg.name,
                    id: msg.id,
                    additional_kwargs: msg.additional_kwargs,
                    response_metadata: msg.response_metadata,
                });
            case 'ai':
                return new AIMessage({
                    content: msg.content,
                    name: msg.name,
                    id: msg.id,
                    additional_kwargs: msg.additional_kwargs,
                    response_metadata: msg.response_metadata,
                    tool_calls: msg.tool_calls,
                });
            case 'system':
                return new SystemMessage({
                    content: msg.content,
                    name: msg.name,
                    id: msg.id,
                    additional_kwargs: msg.additional_kwargs,
                    response_metadata: msg.response_metadata,
                });
            case 'tool':
                return new ToolMessage({
                    content: msg.content,
                    name: msg.name,
                    id: msg.id,
                    tool_call_id: msg.tool_call_id,
                    additional_kwargs: msg.additional_kwargs,
                    response_metadata: msg.response_metadata,
                });
            default:
                return new HumanMessage({
                    content: msg.content,
                });
        }
    });

    return {
        ...serialized,
        messages
    };
}
