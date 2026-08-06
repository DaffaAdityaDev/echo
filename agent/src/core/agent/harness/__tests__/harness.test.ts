import { HumanMessage } from "@langchain/core/messages";
import type { Mock } from "vitest";
import type {
  AgentState,
  AgentStrategy,
  HarnessFeatureToggles,
  LLMProvider,
  ProviderEvent,
  ToolDefinition,
} from "../../../../shared/types";
import { startAgentTrace } from "../../../../shared/utils/langfuse";
import { stateStorage } from "../../storage/factory";
import { cancellationManager } from "../cancel_manager";
import { HARNESS_CONFIG } from "../constants";
import { NlahHarness } from "../harness";
import { LoopDetector } from "../loop_detector";
import { HARNESS_PROMPTS } from "../prompts";
import { DEFAULT_HARNESS_TOGGLES } from "../types";

vi.mock("../../../../shared/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    langfuse: vi.fn(),
  },
}));

vi.mock("../../../../shared/utils/langfuse", () => ({
  langfuseStorage: {
    getStore: () => undefined,
    run: async (_context: unknown, fn: () => Promise<void>) => fn(),
  },
  startAgentTrace: vi.fn(() => null),
}));

vi.mock("../../storage/factory", () => ({
  stateStorage: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    delete: vi.fn(),
  },
}));

const FAKE_TOOL = vi.hoisted(() => ({
  name: "fake_tool",
  description: "Fake tool used by harness tests",
  keywords: ["fake"],
  schema: {},
  execute: vi.fn(async () => ({ status: "success", summary: "did it", data: { ok: true } }) as Record<string, unknown>),
}));

vi.mock("../tools/registry", () => ({
  toolRegistry: { getAllTools: vi.fn(() => [FAKE_TOOL]) },
}));

interface TestPacket {
  type: string;
  [key: string]: unknown;
}

function fakeStrategy(): AgentStrategy {
  return {
    name: "agent",
    buildSystemPrompt: (state: AgentState) => `fake strategy system prompt for ${state.objective}`,
  };
}

function makeProvider(
  script: Array<ProviderEvent[]>,
  options: { maxContextTokens?: number } = {},
): { provider: LLMProvider; stream: Mock } {
  let call = 0;
  const stream = vi.fn(() => {
    const events = script[Math.min(call, script.length - 1)] ?? [];
    call += 1;
    return (async function* () {
      for (const event of events) {
        yield event;
      }
    })();
  });
  const provider: LLMProvider = {
    modelName: "fake-model",
    baseURL: "http://fake.local",
    maxContextTokens: options.maxContextTokens ?? 100000,
    stream,
    cleanupReasoning: vi.fn(async () => {}),
    validate: vi.fn(async () => {}),
  };
  return { provider, stream };
}

function makeState(missionId: string, objective = "Test objective"): AgentState {
  return { missionId, objective, tasks: [], memory: {}, messages: [new HumanMessage(objective)] };
}

function makeHarness(
  provider: LLMProvider,
  overrides: Partial<{
    missionId: string;
    tenantId: string;
    strategy: AgentStrategy;
    harnessConfig: Record<string, unknown>;
  }> = {},
): NlahHarness {
  return new NlahHarness({
    provider,
    strategy: overrides.strategy ?? fakeStrategy(),
    missionId: overrides.missionId ?? "mission-1",
    tenantId: overrides.tenantId ?? "tenant-1",
    tools: [FAKE_TOOL as unknown as ToolDefinition],
    harnessConfig: overrides.harnessConfig,
  });
}

async function runHarness(
  harness: NlahHarness,
  state: AgentState,
  onPacket?: (packet: TestPacket) => Promise<void>,
): Promise<TestPacket[]> {
  const packets: TestPacket[] = [];
  const handler =
    onPacket ??
    (async (packet: TestPacket) => {
      packets.push(packet);
    });
  await harness.runMission(state, handler);
  return packets;
}

describe("NlahHarness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (stateStorage.get as Mock).mockReset();
    (stateStorage.get as Mock).mockResolvedValue(null);
    FAKE_TOOL.execute.mockReset();
    FAKE_TOOL.execute.mockImplementation(async () => ({ status: "success", summary: "did it", data: { ok: true } }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("defaults missionId to a uuid and tenantId to DEFAULT_TENANT_ID", () => {
      const { provider } = makeProvider([]);
      const harness = new NlahHarness({
        provider,
        strategy: fakeStrategy(),
        tools: [FAKE_TOOL as unknown as ToolDefinition],
      }) as unknown as { missionId: string; tenantId: string };

      expect(harness.missionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(harness.tenantId).toBe(HARNESS_CONFIG.DEFAULT_TENANT_ID);
    });

    it("keeps explicit missionId and tenantId", () => {
      const { provider } = makeProvider([]);
      const harness = new NlahHarness({
        provider,
        strategy: fakeStrategy(),
        missionId: "mission-custom",
        tenantId: "tenant-custom",
      }) as unknown as { missionId: string; tenantId: string };

      expect(harness.missionId).toBe("mission-custom");
      expect(harness.tenantId).toBe("tenant-custom");
    });

    it("merges partial harnessConfig over DEFAULT_HARNESS_TOGGLES", () => {
      const { provider } = makeProvider([]);
      const harness = new NlahHarness({
        provider,
        strategy: fakeStrategy(),
        harnessConfig: { systemNotices: { enabled: true, emitBudgetWarnings: false } },
      }) as unknown as { featureToggles: HarnessFeatureToggles };

      expect(harness.featureToggles.systemNotices.enabled).toBe(true);
      expect(harness.featureToggles.systemNotices.emitBudgetWarnings).toBe(false);
      expect(harness.featureToggles.budgetMonitor.maxSteps).toBe(DEFAULT_HARNESS_TOGGLES.budgetMonitor.maxSteps);
      expect(harness.featureToggles.loopDetection.maxConsecutiveIdenticalCalls).toBe(
        DEFAULT_HARNESS_TOGGLES.loopDetection.maxConsecutiveIdenticalCalls,
      );
    });
  });

  describe("runMission", () => {
    it("runs a content-only mission to completion and persists state", async () => {
      const { provider, stream } = makeProvider([
        [
          { content: "Hello world" },
          { usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cachedTokens: 0 } },
        ],
        [{ content: "COMPLETE" }],
      ]);
      const state = makeState("mission-1");
      const harness = makeHarness(provider, { missionId: "mission-1" });
      const packets = await runHarness(harness, state);

      expect(stream).toHaveBeenCalledTimes(2);
      expect(stream.mock.calls[0][2]).toBe("fake strategy system prompt for Test objective");
      expect(stream.mock.calls[0][1].map((tool: { name: string }) => tool.name)).toEqual(["fake_tool"]);
      expect(stream.mock.calls[0][0][0].content).toContain("fake strategy system prompt for Test objective");

      expect(startAgentTrace).toHaveBeenCalledWith(
        expect.any(String),
        "mission-1",
        "tenant-1",
        "agent",
        "Test objective",
      );

      expect(packets.some((p) => p.type === "metadata" && p.content === "Initializing state registry context.")).toBe(
        true,
      );
      expect(
        packets.some((p) => p.type === "metadata" && p.objective === "Test objective" && p.strategy === "agent"),
      ).toBe(true);
      expect(packets.some((p) => p.type === "content" && p.content === "Hello world")).toBe(true);
      expect(packets.some((p) => p.type === "usage" && (p.usage as { totalTokens: number }).totalTokens === 15)).toBe(
        true,
      );
      expect(packets.some((p) => p.type === "state_change" && p.from === "starting" && p.to === "running")).toBe(true);
      expect(packets.some((p) => p.type === "state_change" && p.from === "running" && p.to === "completed")).toBe(true);
      expect(packets.some((p) => p.type === "turn_complete" && p.completed === true && p.totalIterations === 1)).toBe(
        true,
      );

      expect(stateStorage.set).toHaveBeenCalledWith("mission-1", state, 600);
    });

    it("completes in one iteration when the reply only contains tag-like text, without escalating", async () => {
      // "support" is not a protocol/tool tag, so this must NOT escalate to
      // Tier-2 recovery (which would spin the mission to MAX_ITERATIONS).
      const { provider, stream } = makeProvider([
        [{ content: "Contact <support@example.com> for help. Note: a<b." }],
        [{ content: "CLEAR" }],
      ]);
      const state = makeState("mission-escalate-free");
      const harness = makeHarness(provider, { missionId: "mission-escalate-free" });
      const packets = await runHarness(harness, state);

      expect(stream).toHaveBeenCalledTimes(2);
      const turnComplete = packets.find((p) => p.type === "turn_complete");
      expect(turnComplete).toMatchObject({ completed: true, totalIterations: 1 });
      expect(packets.some((p) => p.type === "state_change" && p.to === "completed")).toBe(true);
      expect(packets.some((p) => p.type === "content" && String(p.content).includes("Contact"))).toBe(true);
    });

    it("escalates generic protocol markup to Tier-2 recovery and recovers next turn", async () => {
      // <parameter> is protocol markup but not a known tool, so it escalates
      // (recovery prompt injected, iteration 1 not complete) and the mission
      // completes on the following turn.
      const { provider, stream } = makeProvider([
        [{ content: '<parameter name="query">x</parameter>' }],
        [{ content: "OK" }],
        [{ content: "CLEAR" }],
      ]);
      const state = makeState("mission-escalate");
      const harness = makeHarness(provider, { missionId: "mission-escalate" });
      const packets = await runHarness(harness, state);

      expect(stream).toHaveBeenCalledTimes(3);
      const turnComplete = packets.find((p) => p.type === "turn_complete");
      expect(turnComplete).toMatchObject({ completed: true, totalIterations: 2 });
    });

    it("executes a tool call and emits tool_call and tool_result packets", async () => {
      const { provider } = makeProvider([
        [{ toolCall: { name: "fake_tool", args: { query: "hello" } } }],
        [{ content: "done" }],
        [{ content: "COMPLETE" }],
      ]);
      const harness = makeHarness(provider, { missionId: "mission-2" });
      const packets = await runHarness(harness, makeState("mission-2"));

      expect(FAKE_TOOL.execute).toHaveBeenCalledTimes(1);
      expect(FAKE_TOOL.execute).toHaveBeenCalledWith({ query: "hello" }, expect.objectContaining({ provider }));
      expect(
        packets.some(
          (p) =>
            p.type === "tool_call" &&
            p.toolName === "fake_tool" &&
            (p.toolInput as { query: string }).query === "hello",
        ),
      ).toBe(true);
      expect(
        packets.some(
          (p) =>
            p.type === "tool_result" &&
            p.toolName === "fake_tool" &&
            p.content === "did it" &&
            (p.toolResult as { ok: boolean }).ok === true,
        ),
      ).toBe(true);
      expect(packets.some((p) => p.type === "progress" && p.phase === "tool_execution")).toBe(true);
      expect(packets.some((p) => p.type === "turn_complete" && p.completed === true)).toBe(true);
    });

    it("degrades and opens the circuit after repeated tool failures", async () => {
      const { provider } = makeProvider([
        [{ toolCall: { name: "fake_tool", args: { query: "a" } } }],
        [{ toolCall: { name: "fake_tool", args: { query: "a" } } }],
        [{ toolCall: { name: "fake_tool", args: { query: "a" } } }],
        [{ toolCall: { name: "fake_tool", args: { query: "a" } } }],
        [{ content: "final answer" }],
        [{ content: "COMPLETE" }],
      ]);
      FAKE_TOOL.execute.mockImplementation(async () => {
        throw new Error("boom");
      });
      const harness = makeHarness(provider, {
        missionId: "mission-3",
        harnessConfig: { loopDetection: { enabled: false } },
      });
      const packets = await runHarness(harness, makeState("mission-3"));

      expect(FAKE_TOOL.execute).toHaveBeenCalledTimes(3);
      expect(packets.some((p) => p.type === "tool_result" && String(p.content).includes("Tool execution failed"))).toBe(
        true,
      );
      expect(
        packets.some(
          (p) =>
            p.type === "degraded" && p.from === "nlah" && p.to === "restricted" && p.reason === "circuit_breakers_open",
        ),
      ).toBe(true);
      expect(packets.some((p) => p.type === "state_change" && p.from === "running" && p.to === "degraded")).toBe(true);
      expect(packets.some((p) => p.type === "tool_skip" && p.toolName === "fake_tool")).toBe(true);
      expect(packets.some((p) => p.type === "state_change" && p.to === "completed")).toBe(true);
    });

    it("records an error observation returned by execute without throwing", async () => {
      const { provider } = makeProvider([
        [{ toolCall: { name: "fake_tool", args: { query: "x" } } }],
        [{ content: "ok" }],
        [{ content: "COMPLETE" }],
      ]);
      FAKE_TOOL.execute.mockResolvedValue({ status: "error", summary: "nope", error: "X" });
      const harness = makeHarness(provider, {
        missionId: "mission-4",
        harnessConfig: { loopDetection: { enabled: false } },
      });
      const packets = await runHarness(harness, makeState("mission-4"));

      expect(FAKE_TOOL.execute).toHaveBeenCalledTimes(1);
      expect(packets.some((p) => p.type === "tool_result" && p.content === "nope (retry 1/3)")).toBe(true);
      expect(packets.some((p) => p.type === "state_change" && p.to === "completed")).toBe(true);
      expect(packets.some((p) => p.type === "degraded")).toBe(false);
    });

    it("pauses for HITL approval on a protected tool and resumes to completion", async () => {
      const { provider } = makeProvider([
        [{ toolCall: { name: "fake_tool", args: { query: "delete it" } } }],
        [{ content: "final answer" }],
        [{ content: "COMPLETE" }],
      ]);
      const harness = makeHarness(provider, {
        missionId: "mission-5",
        harnessConfig: { hitlGuard: { protectedTools: ["fake_tool"], ttlMinutes: 5 } },
      });
      const packets = await runHarness(harness, makeState("mission-5"));

      const approval = packets.find((p) => p.type === "hitl_approval_required");
      expect(approval).toBeDefined();
      const approvalPayload = approval?.payload as {
        approvalId: string;
        toolName: string;
        args: Record<string, unknown>;
        riskLevel: string;
        expiresAt: number;
      };
      expect(String(approvalPayload.approvalId)).toMatch(/^appr_/);
      expect(approvalPayload.toolName).toBe("fake_tool");
      expect(approvalPayload.args).toEqual({ query: "delete it" });
      expect(approvalPayload.riskLevel).toBe("high");
      expect(typeof approvalPayload.expiresAt).toBe("number");

      const pausedCall = (stateStorage.set as Mock).mock.calls.find((call) => String(call[0]).startsWith("paused:"));
      expect(pausedCall).toBeDefined();
      expect((pausedCall as [string, unknown, number])[1]).toEqual(
        expect.objectContaining({
          missionId: "mission-5",
          sessionId: "mission-5",
          pendingToolCall: { id: expect.any(String), name: "fake_tool", args: { query: "delete it" } },
          harnessSnapshot: expect.objectContaining({
            strategyName: "agent",
            toolNames: ["fake_tool"],
            delegationDepth: 0,
          }),
        }),
      );
      expect((pausedCall as [string, unknown, number])[2]).toBe(300);

      expect(FAKE_TOOL.execute).not.toHaveBeenCalled();
      expect(packets.some((p) => p.type === "turn_complete" && p.completed === true)).toBe(true);
    });

    it("aborts on budget maxSteps exceeded before calling the provider", async () => {
      const { provider, stream } = makeProvider([[{ toolCall: { name: "fake_tool", args: { query: "x" } } }]]);
      const harness = makeHarness(provider, {
        missionId: "mission-6",
        harnessConfig: {
          budgetMonitor: {
            enabled: true,
            enforceMaxSteps: true,
            maxSteps: 1,
            enforceTimeout: true,
            maxDurationMs: 120000,
            enforceCostCap: true,
            maxCostUsd: 1.0,
          },
        },
      });
      const packets = await runHarness(harness, makeState("mission-6"));

      expect(stream).not.toHaveBeenCalled();
      expect(
        packets.some(
          (p) =>
            p.type === "system_notice" &&
            (p.payload as { code?: string }).code === "BUDGET_WARNING" &&
            (p.payload as { level?: string }).level === "error",
        ),
      ).toBe(true);
      expect(packets.some((p) => p.type === "state_change" && p.to === "aborted")).toBe(true);
      expect(packets.some((p) => p.type === "turn_complete")).toBe(true);
      expect(stateStorage.set).toHaveBeenCalledWith(
        "mission-6",
        expect.objectContaining({ missionId: "mission-6" }),
        600,
      );
    });

    it("cancels gracefully when cancellationManager reports an abort", async () => {
      let cancelled = false;
      vi.spyOn(cancellationManager, "isAborted").mockImplementation(() => cancelled);
      const { provider } = makeProvider([[{ toolCall: { name: "fake_tool", args: { query: "x" } } }]]);
      const harness = makeHarness(provider, { missionId: "mission-7" });
      const packets: TestPacket[] = [];
      const onPacket = async (packet: TestPacket) => {
        packets.push(packet);
        if (packet.type === "tool_result") {
          cancelled = true;
        }
      };
      await harness.runMission(makeState("mission-7"), onPacket);

      expect(FAKE_TOOL.execute).toHaveBeenCalledTimes(1);
      expect(packets.some((p) => p.type === "metadata" && p.content === "Mission execution cancelled.")).toBe(true);
      expect(packets.some((p) => p.type === "turn_complete" && p.completed === false)).toBe(true);
      expect(packets.some((p) => p.type === "state_change" && p.to === "completed")).toBe(false);
    });

    it("stops an identical tool-call chain via exact-match loop detection", async () => {
      const { provider } = makeProvider([
        [{ toolCall: { name: "fake_tool", args: { query: "x" } } }],
        [{ toolCall: { name: "fake_tool", args: { query: "x" } } }],
        [{ toolCall: { name: "fake_tool", args: { query: "x" } } }],
        [{ content: "COMPLETE" }],
      ]);
      const harness = makeHarness(provider, { missionId: "mission-8" });
      const packets = await runHarness(harness, makeState("mission-8"));

      expect(FAKE_TOOL.execute).toHaveBeenCalledTimes(2);
      expect(
        packets.some((p) => p.type === "system_notice" && (p.payload as { code?: string }).code === "LOOP_DETECTED"),
      ).toBe(true);
      expect(packets.filter((p) => p.type === "tool_call").length).toBe(2);
      expect(packets.some((p) => p.type === "state_change" && p.to === "completed")).toBe(true);
    });

    it("restoreLoopDetectorHistory preloads the loop ring buffer", async () => {
      const detector = new LoopDetector();
      const hash = detector.generateHash("fake_tool", { query: "x" });
      const { provider } = makeProvider([
        [{ toolCall: { name: "fake_tool", args: { query: "x" } } }],
        [{ content: "COMPLETE" }],
      ]);
      const harness = makeHarness(provider, { missionId: "mission-9" });
      expect(() => harness.restoreLoopDetectorHistory([hash, hash, hash])).not.toThrow();

      const packets = await runHarness(harness, makeState("mission-9"));

      expect(FAKE_TOOL.execute).not.toHaveBeenCalled();
      expect(
        packets.some((p) => p.type === "system_notice" && (p.payload as { code?: string }).code === "LOOP_DETECTED"),
      ).toBe(true);
      expect(packets.some((p) => p.type === "state_change" && p.to === "completed")).toBe(true);
    });

    it("passes the behaviorPrompt through to the strategy", async () => {
      const { provider } = makeProvider([[{ content: "COMPLETE" }]]);
      let received: unknown = null;
      const strategy: AgentStrategy = {
        name: "agent",
        buildSystemPrompt: (_state: AgentState, _tools: ToolDefinition[], behaviorPrompt?: unknown) => {
          received = behaviorPrompt;
          return "behavior-aware prompt";
        },
      };
      const behaviorPrompt = {
        templateName: "custom-template",
        version: 1,
        systemPrompt: "custom system prompt",
        boundTools: ["fake_tool"],
        variables: [],
      };
      const harness = new NlahHarness({
        provider,
        strategy,
        missionId: "mission-bp",
        tenantId: "tenant-1",
        tools: [FAKE_TOOL as unknown as ToolDefinition],
        behaviorPrompt,
      });
      const packets = await runHarness(harness, makeState("mission-bp"));

      expect(received).toEqual(behaviorPrompt);
      expect(packets.some((p) => p.type === "state_change" && p.to === "completed")).toBe(true);
    });

    it("filters explicit tools down to the behavior prompt bound tools", async () => {
      const { provider, stream } = makeProvider([[{ content: "COMPLETE" }]]);
      const harness = new NlahHarness({
        provider,
        strategy: fakeStrategy(),
        missionId: "mission-bp2",
        tenantId: "tenant-1",
        tools: [FAKE_TOOL as unknown as ToolDefinition],
        behaviorPrompt: {
          templateName: "custom-template",
          version: 1,
          systemPrompt: "custom system prompt",
          boundTools: ["write_todos"],
          variables: [],
        },
      });
      const packets = await runHarness(harness, makeState("mission-bp2"));

      expect(stream.mock.calls[0][1]).toEqual([]);
      expect(packets.some((p) => p.type === "state_change" && p.to === "completed")).toBe(true);
    });

    it("compacts context when the token ratio crosses the threshold", async () => {
      const longMessage = "a".repeat(800);
      const state: AgentState = {
        missionId: "mission-10",
        objective: "Test objective",
        tasks: [],
        memory: {},
        messages: [
          new HumanMessage("Test objective"),
          new HumanMessage(longMessage),
          new HumanMessage(longMessage),
          new HumanMessage(longMessage),
          new HumanMessage(longMessage),
          new HumanMessage(longMessage),
        ],
      };
      const { provider, stream } = makeProvider(
        [
          [
            {
              content:
                '{"decisions":["ok"],"accomplishments":[],"facts":{},"pending_challenges":[],"next_course_of_action":[{"priority":1,"action":"proceed"}]}',
            },
          ],
          [{ content: "final answer" }],
          [{ content: "COMPLETE" }],
        ],
        { maxContextTokens: 1000 },
      );
      const harness = makeHarness(provider, { missionId: "mission-10" });
      const packets = await runHarness(harness, state);

      expect(stream.mock.calls[0][2]).toBe(HARNESS_PROMPTS.COMPACTION_SYSTEM);
      expect(packets.some((p) => p.type === "reasoning" && String(p.content).includes("Context compacted"))).toBe(true);
      expect(String(state.messages[1].content)).toContain("<context_reconstruction>");
      expect(packets.some((p) => p.type === "state_change" && p.to === "completed")).toBe(true);
    });
  });
});
