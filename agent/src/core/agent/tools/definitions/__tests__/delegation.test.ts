import type { LLMProvider } from "../../../../../shared/types";
import { delegate_task } from "../delegation";

const mocks = vi.hoisted(() => ({
  harnessRunImpl: async (
    _state: unknown,
    _onPacket: (packet: { type: string; content?: string }) => Promise<void>,
  ): Promise<void> => {},
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
      state: unknown,
      onPacket: (packet: { type: string; content?: string }) => Promise<void>,
    ): Promise<void> {
      await mocks.harnessRunImpl(state, onPacket);
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
  const provider = { stream: vi.fn() } as unknown as LLMProvider;

  beforeEach(() => {
    mocks.harnessRunImpl = async (
      _state: unknown,
      onPacket: (packet: { type: string; content?: string }) => Promise<void>,
    ) => {
      await onPacket({ type: "content", content: "Child final output" });
      await onPacket({ type: "reasoning", content: "Child reasoning" });
    };
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
        expect(parsed.data.fork_context).toBe(false);
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
        _state: unknown,
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
});
