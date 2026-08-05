import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { AgentState } from "../../../shared/types";

interface SerializedMessage {
  type: string;
  content?: string;
  name?: string;
  id?: string;
  additional_kwargs?: Record<string, unknown>;
  response_metadata?: Record<string, unknown>;
  tool_call_id?: string;
  tool_calls?: Array<{ name: string; args: Record<string, unknown>; id: string; type?: "tool_call" }>;
}

export function serializeAgentState(state: AgentState) {
  return {
    ...state,
    messages: state.messages.map((msg) => ({
      type: msg._getType(),
      content: msg.content,
      name: msg.name,
      id: msg.id,
      additional_kwargs: msg.additional_kwargs,
      response_metadata: msg.response_metadata,
      tool_call_id: (msg as { tool_call_id?: string }).tool_call_id,
      tool_calls: (msg as { tool_calls?: unknown }).tool_calls,
    })),
  };
}

export function deserializeAgentState(serialized: unknown): AgentState {
  if (!serialized) return serialized as AgentState;

  const raw = serialized as Record<string, unknown>;
  const messages = ((raw.messages || []) as SerializedMessage[]).map((msg) => {
    switch (msg.type) {
      case "human":
        return new HumanMessage({
          content: msg.content,
          name: msg.name,
          id: msg.id,
          additional_kwargs: msg.additional_kwargs,
          response_metadata: msg.response_metadata,
        });
      case "ai":
        return new AIMessage({
          content: msg.content,
          name: msg.name,
          id: msg.id,
          additional_kwargs: msg.additional_kwargs,
          response_metadata: msg.response_metadata,
          tool_calls: msg.tool_calls,
        });
      case "system":
        return new SystemMessage({
          content: msg.content,
          name: msg.name,
          id: msg.id,
          additional_kwargs: msg.additional_kwargs,
          response_metadata: msg.response_metadata,
        });
      case "tool":
        return new ToolMessage({
          content: msg.content,
          name: msg.name,
          id: msg.id,
          tool_call_id: msg.tool_call_id as string,
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
    ...raw,
    messages,
  } as AgentState;
}
