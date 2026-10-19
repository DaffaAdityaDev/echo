import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { AgentState, PausedMissionState } from "../../../../shared/types";
import { DEFAULT_HARNESS_TOGGLES } from "../../harness/types";
import type { StateStore } from "../factory";
import { InMemoryStateProvider } from "../memory";
import { missionStateKey, pausedStateKey } from "../state-key";

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

function makePausedState(): PausedMissionState {
  return {
    approvalId: "appr_1",
    missionId: "test-mission",
    sessionId: "test-mission",
    pendingToolCall: { id: "tool_1", name: "delete_file", args: { path: "/tmp/x" } },
    state: makeState(),
    harnessSnapshot: {
      strategyName: "agent",
      toolNames: ["delete_file"],
      providerConfig: { type: "openai", base_url: "http://fake.local", api_key: null, model: "fake" },
      delegationDepth: 0,
      featureToggles: DEFAULT_HARNESS_TOGGLES,
    },
    metadata: { totalCostUsd: 0, loopDetectorHistory: [], pausedAt: "2026-01-01T00:00:00.000Z", expiresAt: 0 },
  };
}

describe("InMemoryStateProvider", () => {
  let provider: InMemoryStateProvider;

  beforeEach(() => {
    provider = new InMemoryStateProvider();
  });

  test("set then get returns an equivalent AgentState", async () => {
    const original = makeState();
    await provider.set(missionStateKey(original.missionId), original, 3600);

    const got = await provider.get(missionStateKey(original.missionId));
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
    await expect(provider.get(missionStateKey("missing-mission"))).resolves.toBeNull();
  });

  test("set overwrites an existing state", async () => {
    await provider.set(missionStateKey("m1"), makeState({ objective: "First objective" }));
    await provider.set(missionStateKey("m1"), makeState({ objective: "Second objective" }));

    const got = await provider.get(missionStateKey("m1"));
    expect(got?.objective).toBe("Second objective");
  });

  test("delete removes the stored state", async () => {
    await provider.set(missionStateKey("m1"), makeState());
    await provider.delete(missionStateKey("m1"));

    await expect(provider.get(missionStateKey("m1"))).resolves.toBeNull();
  });

  test("delete on a missing key does not throw", async () => {
    await expect(provider.delete(missionStateKey("never-stored"))).resolves.toBeUndefined();
  });

  test("set without a ttl still stores the state", async () => {
    await expect(provider.set(missionStateKey("m1"), makeState())).resolves.toBeUndefined();
    await expect(provider.get(missionStateKey("m1"))).resolves.not.toBeNull();
  });

  test("expired ttl entries are evicted and get returns null", async () => {
    vi.useFakeTimers();

    try {
      await provider.set(missionStateKey("m1"), makeState(), 60);
      await expect(provider.get(missionStateKey("m1"))).resolves.not.toBeNull();

      vi.advanceTimersByTime(60_000);
      await expect(provider.get(missionStateKey("m1"))).resolves.toBeNull();
      await expect(provider.get(missionStateKey("m1"))).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("a ttl of 0 or undefined never expires", async () => {
    await provider.set(missionStateKey("m1"), makeState(), 0);
    vi.useFakeTimers();

    try {
      vi.advanceTimersByTime(86_400_000);
      await expect(provider.get(missionStateKey("m1"))).resolves.not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("an expired entry can be overwritten into a fresh state", async () => {
    vi.useFakeTimers();

    try {
      await provider.set(missionStateKey("m1"), makeState(), 60);
      vi.advanceTimersByTime(60_000);
      await provider.set(missionStateKey("m1"), makeState({ objective: "Second objective" }), 60);
      const got = await provider.get(missionStateKey("m1"));
      expect(got?.objective).toBe("Second objective");
    } finally {
      vi.useRealTimers();
    }
  });

  test("a paused slot is stored separately from the session's mission state", async () => {
    await provider.set(missionStateKey("test-mission"), makeState({ objective: "Mission state" }));
    await provider.set(pausedStateKey("test-mission", "appr_1"), makePausedState());

    await expect(provider.get(missionStateKey("test-mission"))).resolves.toMatchObject({ objective: "Mission state" });
    await provider.delete(pausedStateKey("test-mission", "appr_1"));
    await expect(provider.get(pausedStateKey("test-mission", "appr_1"))).resolves.toBeNull();
    await expect(provider.get(missionStateKey("test-mission"))).resolves.not.toBeNull();
  });

  test("a paused slot is not reachable from another session", async () => {
    await provider.set(pausedStateKey("session-a", "appr_1"), makePausedState());

    await expect(provider.get(pausedStateKey("session-b", "appr_1"))).resolves.toBeNull();
  });

  test("set then get round-trips the LangChain messages nested in a paused HITL state", async () => {
    const store: StateStore = provider;
    await store.set(pausedStateKey("test-mission", "appr_1"), makePausedState(), 300);

    const paused = await store.get(pausedStateKey("test-mission", "appr_1"));

    if (!paused || !("pendingToolCall" in paused)) throw new Error("expected a paused mission state");
    expect(paused.pendingToolCall).toEqual({ id: "tool_1", name: "delete_file", args: { path: "/tmp/x" } });
    const messages = paused.state.messages;
    expect(messages).toHaveLength(4);
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect(messages[0].content).toBe("Be helpful");
    expect(messages[1]).toBeInstanceOf(HumanMessage);
    expect(messages[1].content).toBe("Hi");
    expect(messages[2]).toBeInstanceOf(AIMessage);
    expect((messages[2] as AIMessage).tool_calls).toHaveLength(1);
    expect(messages[3]).toBeInstanceOf(ToolMessage);
    expect((messages[3] as ToolMessage).tool_call_id).toBe("call-1");
  });
});
