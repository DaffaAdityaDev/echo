
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { serializeAgentState, deserializeAgentState } from "../serializer";
import type { AgentState } from "../../../../shared/types";

function makeState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    missionId: "test-mission",
    objective: "Test objective",
    tasks: [],
    memory: {},
    messages: [],
    ...overrides,
  };
}

describe("serializeAgentState", () => {
  test("converts AgentState with human message to plain JSON", () => {
    const state = makeState({
      messages: [new HumanMessage({ content: "Hello" })],
    });

    const serialized = serializeAgentState(state);
    expect(serialized.messages).toHaveLength(1);
    expect(serialized.messages[0].type).toBe("human");
    expect(serialized.messages[0].content).toBe("Hello");
    expect(serialized.missionId).toBe("test-mission");
  });

  test("converts AgentState with all message types", () => {
    const messages = [
      new SystemMessage({ content: "System prompt", id: "sys-1" }),
      new HumanMessage({ content: "Human input", id: "human-1", name: "user" }),
      new AIMessage({
        content: "AI response",
        id: "ai-1",
        tool_calls: [{ name: "search", args: { q: "test" }, id: "call-1" }],
      }),
      new ToolMessage({
        content: '{"result": "ok"}',
        id: "tool-1",
        tool_call_id: "call-1",
        name: "search",
      }),
    ];
    const state = makeState({ messages });

    const serialized = serializeAgentState(state);
    expect(serialized.messages).toHaveLength(4);
    expect(serialized.messages[0].type).toBe("system");
    expect(serialized.messages[1].type).toBe("human");
    expect(serialized.messages[2].type).toBe("ai");
    expect(serialized.messages[2].tool_calls).toHaveLength(1);
    expect(serialized.messages[3].type).toBe("tool");
    expect(serialized.messages[3].tool_call_id).toBe("call-1");
  });

  test("serializes tasks and memory fields", () => {
    const state = makeState({
      tasks: [{ id: "t1", description: "Do something", status: "pending" }],
      memory: { key: "value" },
      currentTaskId: "t1",
    });

    const serialized = serializeAgentState(state);
    expect(serialized.tasks).toHaveLength(1);
    expect(serialized.memory.key).toBe("value");
    expect(serialized.currentTaskId).toBe("t1");
  });

  test("serializes empty messages array", () => {
    const state = makeState();
    const serialized = serializeAgentState(state);
    expect(serialized.messages).toEqual([]);
  });
});

describe("deserializeAgentState", () => {
  test("converts plain JSON back to AgentState with LangChain messages", () => {
    const serialized = {
      missionId: "test-mission",
      objective: "Test",
      tasks: [],
      memory: {},
      messages: [
        { type: "human", content: "Hello" },
        { type: "ai", content: "Hi there", tool_calls: [] },
      ],
    };

    const state = deserializeAgentState(serialized);
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]).toBeInstanceOf(HumanMessage);
    expect(state.messages[0].content).toBe("Hello");
    expect(state.messages[1]).toBeInstanceOf(AIMessage);
    expect(state.messages[1].content).toBe("Hi there");
  });

  test("deserializes all message types correctly", () => {
    const serialized = {
      missionId: "m1",
      objective: "O1",
      tasks: [],
      memory: {},
      messages: [
        { type: "system", content: "sys" },
        { type: "human", content: "human" },
        { type: "ai", content: "ai" },
        { type: "tool", content: "tool", tool_call_id: "c1" },
      ],
    };

    const state = deserializeAgentState(serialized);
    expect(state.messages[0]).toBeInstanceOf(SystemMessage);
    expect(state.messages[1]).toBeInstanceOf(HumanMessage);
    expect(state.messages[2]).toBeInstanceOf(AIMessage);
    expect(state.messages[3]).toBeInstanceOf(ToolMessage);
    expect((state.messages[3] as ToolMessage).tool_call_id).toBe("c1");
  });

  test("handles unknown message type by defaulting to HumanMessage", () => {
    const serialized = {
      missionId: "m1",
      objective: "O1",
      tasks: [],
      memory: {},
      messages: [{ type: "unknown_kind", content: "fallback" }],
    };

    const state = deserializeAgentState(serialized);
    expect(state.messages[0]).toBeInstanceOf(HumanMessage);
    expect(state.messages[0].content).toBe("fallback");
  });

  test("returns the value as-is when serialized is null/undefined", () => {
    expect(deserializeAgentState(null)).toBeNull();
    expect(deserializeAgentState(undefined)).toBeUndefined();
  });

  test("handles empty messages array", () => {
    const serialized = { missionId: "m1", objective: "O1", tasks: [], memory: {}, messages: [] };
    const state = deserializeAgentState(serialized);
    expect(state.messages).toEqual([]);
  });
});

describe("round-trip", () => {
  test("serialize then deserialize returns equivalent state", () => {
    const original = makeState({
      tasks: [{ id: "t1", description: "Task 1", status: "pending" }],
      memory: { key: "value", nested: { a: 1 } },
      currentTaskId: "t1",
      messages: [
        new SystemMessage({ content: "Be helpful", id: "sys-1" }),
        new HumanMessage({ content: "Hi", id: "h-1", name: "user" }),
        new AIMessage({
          content: "Hello!",
          id: "a-1",
          tool_calls: [{ name: "search", args: { q: "test" }, id: "call-1" }],
        }),
        new ToolMessage({
          content: "results",
          id: "t-1",
          tool_call_id: "call-1",
          name: "search",
        }),
      ],
    });

    const serialized = serializeAgentState(original);
    const deserialized = deserializeAgentState(serialized);

    expect(deserialized.missionId).toBe(original.missionId);
    expect(deserialized.objective).toBe(original.objective);
    expect(deserialized.tasks).toEqual(original.tasks);
    expect(deserialized.memory).toEqual(original.memory);
    expect(deserialized.currentTaskId).toBe(original.currentTaskId);
    expect(deserialized.messages).toHaveLength(original.messages.length);
    expect(deserialized.messages[0]).toBeInstanceOf(SystemMessage);
    expect(deserialized.messages[1]).toBeInstanceOf(HumanMessage);
    expect(deserialized.messages[2]).toBeInstanceOf(AIMessage);
    expect(deserialized.messages[3]).toBeInstanceOf(ToolMessage);
    expect(deserialized.messages[2].content).toBe("Hello!");
    expect((deserialized.messages[2] as AIMessage).tool_calls).toHaveLength(1);
  });
});
