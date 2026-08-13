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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSerializedMessage(value: unknown): value is SerializedMessage {
  return isPlainObject(value) && typeof value.type === "string";
}

export function isSerializedAgentState(value: unknown): value is Record<string, unknown> & {
  missionId: string;
  objective: string;
  tasks: unknown[];
  memory: Record<string, unknown>;
  messages: SerializedMessage[];
} {
  return (
    isPlainObject(value) &&
    typeof value.missionId === "string" &&
    typeof value.objective === "string" &&
    Array.isArray(value.tasks) &&
    isPlainObject(value.memory) &&
    Array.isArray(value.messages) &&
    value.messages.every(isSerializedMessage)
  );
}

function isSerializedPausedState(
  value: Record<string, unknown>,
): value is Record<string, unknown> & { approvalId: string; state: unknown } {
  return typeof value.approvalId === "string" && "state" in value && isSerializedAgentState(value.state);
}

export function serializeAgentState(state: AgentState) {
  return {
    ...state,
    messages: Array.isArray(state.messages)
      ? state.messages.map((msg) => ({
          type: msg._getType(),
          content: msg.content,
          name: msg.name,
          id: msg.id,
          additional_kwargs: msg.additional_kwargs,
          response_metadata: msg.response_metadata,
          tool_call_id: (msg as { tool_call_id?: string }).tool_call_id,
          tool_calls: (msg as { tool_calls?: unknown }).tool_calls,
        }))
      : [],
  };
}

function deserializeMessages(messages: SerializedMessage[]) {
  return messages.map((msg) => {
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
}

export function deserializeAgentState(serialized: unknown): AgentState | null {
  if (!isPlainObject(serialized)) return null;

  if (isSerializedAgentState(serialized)) {
    return {
      ...serialized,
      messages: deserializeMessages(serialized.messages),
    } as AgentState;
  }

  if (isSerializedPausedState(serialized)) {
    // The paused-state payload embeds an AgentState under `state`; restore its
    // messages so HITL resume hands the harness real LangChain messages.
    const restored = deserializeAgentState(serialized.state);
    if (!restored) return null;
    return { ...serialized, state: restored } as unknown as AgentState;
  }

  return null;
}
