import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { AgentState } from "../../../../shared/types";
import { InMemoryStateProvider } from "../memory";

function makeState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    missionId: "test-mission",
    objective: "Test objective",
    tasks: [{ id: "t1", description: "Do something", status: "pending" }],
    memory: { key: "value", nested: { a: 1 } },
    messages: [
      new SystemMessage({ content: "Be helpful", id: "sys-1" }),
      new HumanMessage({ content: "Hi", id: "h-1", name: "user" }),
      new AIMessage({
        content: "Hello!",
        id: "a-1",
        tool_calls: [{ name: "search", args: { q: "test" }, id: "call-1" }],
      }),
      new ToolMessage({ content: "results", id: "t-1", tool_call_id: "call-1", name: "search" }),
    ],
    currentTaskId: "t1",
    ...overrides,
  };
}

describe("InMemoryStateProvider", () => {
  let provider: InMemoryStateProvider;

  beforeEach(() => {
    provider = new InMemoryStateProvider();
  });

  test("set then get returns an equivalent AgentState", async () => {
    const original = makeState();
    await provider.set(original.missionId, original, 3600);

    const got = await provider.get(original.missionId);
    expect(got).not.toBeNull();
    const state = got as AgentState;
    expect(state.missionId).toBe(original.missionId);
    expect(state.objective).toBe(original.objective);
    expect(state.tasks).toEqual(original.tasks);
    expect(state.memory).toEqual(original.memory);
    expect(state.currentTaskId).toBe(original.currentTaskId);
    expect(state.messages).toHaveLength(original.messages.length);
    expect(state.messages[0]).toBeInstanceOf(SystemMessage);
    expect(state.messages[1]).toBeInstanceOf(HumanMessage);
    expect(state.messages[1].content).toBe("Hi");
    expect(state.messages[2]).toBeInstanceOf(AIMessage);
    expect((state.messages[2] as AIMessage).tool_calls).toHaveLength(1);
    expect(state.messages[3]).toBeInstanceOf(ToolMessage);
    expect((state.messages[3] as ToolMessage).tool_call_id).toBe("call-1");
  });

  test("get returns null for an unknown missionId", async () => {
    await expect(provider.get("missing-mission")).resolves.toBeNull();
  });

  test("set overwrites an existing state", async () => {
    await provider.set("m1", makeState({ objective: "First objective" }));
    await provider.set("m1", makeState({ objective: "Second objective" }));

    const got = await provider.get("m1");
    expect(got?.objective).toBe("Second objective");
  });

  test("delete removes the stored state", async () => {
    await provider.set("m1", makeState());
    await provider.delete("m1");

    await expect(provider.get("m1")).resolves.toBeNull();
  });

  test("delete on a missing key does not throw", async () => {
    await expect(provider.delete("never-stored")).resolves.toBeUndefined();
  });

  test("set without a ttl still stores the state", async () => {
    await expect(provider.set("m1", makeState())).resolves.toBeUndefined();
    await expect(provider.get("m1")).resolves.not.toBeNull();
  });
});
