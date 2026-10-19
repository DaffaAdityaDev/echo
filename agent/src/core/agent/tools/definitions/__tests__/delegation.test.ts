import type { AgentState, LLMProvider } from "../../../../../shared/types";
import { cancellationManager } from "../../../harness/cancel-manager";
import { delegate_task, executeDelegation } from "../delegation";

const mocks = vi.hoisted(() => ({
  harnessRunImpl: async (
    _state: AgentState,
    _onPacket: (packet: { type: string; content?: string }) => Promise<void>,
  ): Promise<void> => {},
  childCostUsd: 0,
}));

vi.mock("../../../../../shared/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    agentActivity: vi.fn(),
    langfuse: vi.fn(),
    telemetry: vi.fn(),
  },
}));

vi.mock("../../../../../shared/utils/langfuse", () => ({
  langfuseStorage: {
    getStore: () => ({ sessionId: "parent-mission" }),
  },
  getLangChainCallbacks: vi.fn().mockResolvedValue([]),
  startAgentTrace: vi.fn(),
  propagateAttributes: vi.fn(),
}));

vi.mock("../../../harness", () => {
  class MockNlahHarness {
    async runMission(
      state: AgentState,
      onPacket: (packet: { type: string; content?: string }) => Promise<void>,
    ): Promise<void> {
      await mocks.harnessRunImpl(state, onPacket);
    }

    getTotalCostUsd(): number {
      return mocks.childCostUsd;
    }
  }

  return { NlahHarness: MockNlahHarness };
});

describe("delegate_task", () => {
  const validInput = {
    agentName: "researcher-agent",
    instruction: "Research the market size",
    systemPrompt: "You are a research analyst.",
    fork_context: false,
  };

  // SAFETY: Test mock fixture implementing LLMProvider
  const provider = { stream: vi.fn() } as LLMProvider;

  beforeEach(() => {
    mocks.harnessRunImpl = async (
      _state: AgentState,
      onPacket: (packet: { type: string; content?: string }) => Promise<void>,
    ) => {
      await onPacket({ type: "content", content: "Child final output" });
      await onPacket({ type: "reasoning", content: "Child reasoning" });
    };

    mocks.childCostUsd = 0;
    vi.clearAllMocks();
  });

  test("exposes the expected name, description and keywords", () => {
    expect(delegate_task.name).toBe("delegate_task");
    expect(delegate_task.description.length).toBeGreaterThan(0);
    expect(delegate_task.keywords).toContain("sub-agent");
  });

  describe("schema", () => {
    test("parses valid input and defaults fork_context to false", () => {
      const parsed = delegate_task.schema.safeParse({
        agentName: "researcher-agent",
        instruction: "Research",
        systemPrompt: "Be a researcher",
      });

      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data).toMatchObject({ fork_context: false });
      }
    });

    test("rejects input missing required fields", () => {
      const parsed = delegate_task.schema.safeParse({ agentName: "researcher-agent" });
      expect(parsed.success).toBe(false);
    });
  });

  describe("execute", () => {
    test("returns a success observation when the sub-agent completes", async () => {
      const observation = await delegate_task.execute(validInput, { provider });

      expect(observation.status).toBe("success");
      expect(observation.summary).toContain("researcher-agent");
      expect(observation.summary).toContain("Child final output");
      const data = observation.data as { result: string; agentName: string; logs: string[] };
      expect(data.result).toBe("Child final output");
      expect(data.agentName).toBe("researcher-agent");
      expect(data.logs.length).toBeGreaterThan(0);
    });

    test("collects reasoning packets into the step logs", async () => {
      mocks.harnessRunImpl = async (
        _state: AgentState,
        onPacket: (packet: { type: string; content?: string }) => Promise<void>,
      ) => {
        await onPacket({ type: "reasoning", content: "Step one" });
      };

      const observation = await delegate_task.execute(validInput, { provider });

      expect(observation.status).toBe("success");
      expect((observation.data as { logs: string[] }).logs.join("\n")).toContain("Step one");
    });

    test("returns an error observation when no provider is configured", async () => {
      const observation = await delegate_task.execute(validInput);

      expect(observation.status).toBe("error");
      expect(observation.error).toBe("LLMProvider is required for delegation");
      expect(observation.summary).toContain("researcher-agent");
    });

    test("returns an error observation when the child harness fails", async () => {
      mocks.harnessRunImpl = async () => {
        throw new Error("child mission crashed");
      };

      const observation = await delegate_task.execute(validInput, { provider });

      expect(observation.status).toBe("error");
      expect(observation.error).toBe("child mission crashed");
      expect(observation.summary).toContain("child mission crashed");
    });
  });

  describe("parent mission linkage", () => {
    test("adds the child's cost to the parent even when the child fails", async () => {
      mocks.childCostUsd = 0.42;
      mocks.harnessRunImpl = async () => {
        throw new Error("child mission crashed");
      };
      const addCostUsd = vi.fn();

      await executeDelegation(validInput, { provider, addCostUsd });

      expect(addCostUsd).toHaveBeenCalledWith(0.42);
    });

    test("cancelling the parent mission aborts the child's signal", async () => {
      cancellationManager.register("parent-cancel-test");
      let childSignal: AbortSignal | undefined;
      mocks.harnessRunImpl = async (state: AgentState) => {
        childSignal = cancellationManager.getSignal(state.missionId);
        cancellationManager.cancelLocal("parent-cancel-test");
      };

      await executeDelegation(validInput, { provider, missionId: "parent-cancel-test" });

      expect(childSignal?.aborted).toBe(true);
      cancellationManager.clearCancelled("parent-cancel-test");
    });

    test("unregisters the child mission after it completes", async () => {
      let childMissionId = "";
      mocks.harnessRunImpl = async (state: AgentState) => {
        childMissionId = state.missionId;
      };

      await executeDelegation(validInput, { provider });

      expect(childMissionId).not.toBe("");
      expect(cancellationManager.isActive(childMissionId)).toBe(false);
    });
  });
});
