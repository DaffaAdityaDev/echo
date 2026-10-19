import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { AgentState, JsonObject, JsonValue, PausedMissionState, Task } from "../../../shared/types";

type SerializedToolCall = {
  name: string;
  args: JsonObject;
  id: string;
  type?: "tool_call";
};

type SerializedMessage = {
  type: string;
  content?: string;
  name?: string;
  id?: string;
  additional_kwargs?: JsonObject;
  response_metadata?: JsonObject;
  tool_call_id?: string;
  tool_calls?: SerializedToolCall[];
};

function isPlainObject(value: JsonValue | undefined | null): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSerializedMessage(value: JsonValue): value is SerializedMessage & JsonObject {
  return isPlainObject(value) && typeof value.type === "string";
}

export interface SerializedAgentState extends JsonObject {
  missionId: string;
  objective: string;
  tasks: Task[];
  memory: JsonObject;
  messages: SerializedMessage[];
}

export function isSerializedAgentState(value: JsonValue): value is SerializedAgentState {
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

export interface SerializedPausedState extends JsonObject {
  approvalId: string;
  state: JsonValue;
}

function isSerializedPausedState(value: JsonObject): value is SerializedPausedState {
  return typeof value.approvalId === "string" && "state" in value && isSerializedAgentState(value.state);
}

function isString(val: unknown): val is string {
  return typeof val === "string";
}

function getToolCallId(msg: BaseMessage): string | undefined {
  if ("tool_call_id" in msg && isString(msg.tool_call_id)) {
    return msg.tool_call_id;
  }

  return undefined;
}

function getToolCalls(msg: BaseMessage): SerializedToolCall[] | undefined {
  if ("tool_calls" in msg && Array.isArray(msg.tool_calls)) {
    // SAFETY: LangChain tool_calls attribute conforms to SerializedToolCall structure
    return msg.tool_calls as SerializedToolCall[];
  }

  return undefined;
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
          // SAFETY: LangChain message kwargs and metadata are JSON-serializable dictionaries
          additional_kwargs: msg.additional_kwargs as JsonObject | undefined,
          // SAFETY: LangChain response_metadata conforms to JsonObject dictionary
          response_metadata: msg.response_metadata as JsonObject | undefined,
          tool_call_id: getToolCallId(msg),
          tool_calls: getToolCalls(msg),
        }))
      : [],
  };
}

function isPausedMissionState(value: AgentState | PausedMissionState): value is PausedMissionState {
  return "pendingToolCall" in value && "harnessSnapshot" in value;
}

// A paused HITL record nests its AgentState under `state`; serialising it
// verbatim would emit LangChain's toJSON() constructor form, which the
// deserialiser cannot map back to typed messages.
export function serializeStoredState(value: AgentState | PausedMissionState) {
  if (isPausedMissionState(value)) {
    return { ...value, state: serializeAgentState(value.state) };
  }

  return serializeAgentState(value);
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
          tool_call_id: msg.tool_call_id ?? "",
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

export function deserializeAgentState(serialized: JsonValue | null | undefined): AgentState | null {
  if (!isPlainObject(serialized)) return null;

  if (isSerializedAgentState(serialized)) {
    // SAFETY: Deserialized state restores typed messages while preserving optional state fields
    return {
      ...serialized,
      missionId: serialized.missionId,
      objective: serialized.objective,
      tasks: serialized.tasks,
      memory: serialized.memory,
      messages: deserializeMessages(serialized.messages),
    } as AgentState;
  }

  if (isSerializedPausedState(serialized)) {
    // The paused-state payload embeds an AgentState under `state`; restore its
    // messages so HITL resume hands the harness real LangChain messages.
    const restored = deserializeAgentState(serialized.state);

    if (!restored) return null;

    // SAFETY: HITL PausedMissionState merges nested AgentState fields for backward compatibility
    return {
      ...serialized,
      missionId: restored.missionId,
      objective: restored.objective,
      tasks: restored.tasks,
      memory: restored.memory,
      messages: restored.messages,
      state: restored,
    } as AgentState;
  }

  return null;
}
