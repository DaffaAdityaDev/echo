import { HumanMessage } from "@langchain/core/messages";
import type { Mock } from "vitest";
import { z } from "zod";
import type {
  AgentState,
  AgentStrategy,
  HarnessFeatureToggles,
  JsonValue,
  ProviderEvent,
  ToolDefinition,
} from "../../../../shared/types";
import { startAgentTrace } from "../../../../shared/utils/langfuse";
import type { BehaviorPrompt } from "../../prompts";
import { stateStorage } from "../../storage/factory";
import { HARNESS_CONFIG } from "../constants";
import { mergeFeatureToggles, NlahHarness } from "../harness";
import { HARNESS_PROMPTS } from "../prompts";
import { DEFAULT_HARNESS_TOGGLES } from "../types";
import {
  FAKE_TOOL,
  fakeExecute,
  fakeStrategy,
  makeHarness,
  makeProvider,
  makeState,
  resetFakeExecute,
  runHarness,
} from "./harness-test-kit";

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
    run: async (_context: JsonValue, fn: () => Promise<void>) => fn(),
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

interface HarnessInternals {
  missionId: string;
  tenantId: string;
  featureToggles: HarnessFeatureToggles;
}

function readInternals(harness: NlahHarness): HarnessInternals {
  return {
    missionId: harness["missionId"],
    tenantId: harness["tenantId"],
    featureToggles: harness["featureToggles"],
  };
}

describe("NlahHarness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (stateStorage.get as Mock).mockReset();
    (stateStorage.get as Mock).mockResolvedValue(null);
    resetFakeExecute();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("defaults missionId to a uuid and tenantId to DEFAULT_TENANT_ID", () => {
      const { provider } = makeProvider([]);

      const harness = readInternals(
        new NlahHarness({
          provider,
          strategy: fakeStrategy(),
          tools: [FAKE_TOOL],
        }),
      );

      expect(harness.missionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(harness.tenantId).toBe(HARNESS_CONFIG.DEFAULT_TENANT_ID);
    });

    it("keeps explicit missionId and tenantId", () => {
      const { provider } = makeProvider([]);

      const harness = readInternals(
        new NlahHarness({
          provider,
          strategy: fakeStrategy(),
          missionId: "mission-custom",
          tenantId: "tenant-custom",
        }),
      );

      expect(harness.missionId).toBe("mission-custom");
      expect(harness.tenantId).toBe("tenant-custom");
    });

    it("merges partial harnessConfig over DEFAULT_HARNESS_TOGGLES", () => {
      const { provider } = makeProvider([]);

      const harness = readInternals(
        new NlahHarness({
          provider,
          strategy: fakeStrategy(),
          harnessConfig: { systemNotices: { enabled: true, emitBudgetWarnings: false } },
        }),
      );

      expect(harness.featureToggles.systemNotices.enabled).toBe(true);
      expect(harness.featureToggles.systemNotices.emitBudgetWarnings).toBe(false);
      expect(harness.featureToggles.budgetMonitor.maxSteps).toBe(DEFAULT_HARNESS_TOGGLES.budgetMonitor.maxSteps);
      expect(harness.featureToggles.loopDetection.maxConsecutiveIdenticalCalls).toBe(
        DEFAULT_HARNESS_TOGGLES.loopDetection.maxConsecutiveIdenticalCalls,
      );
    });

    it("keeps section defaults when a toggle section is only partially overridden", () => {
      const toggles = mergeFeatureToggles({ loopDetection: { enabled: true, windowSize: 4 } });

      expect(toggles.loopDetection.enableExactMatch).toBe(true);
      expect(toggles.loopDetection.windowSize).toBe(4);
      expect(toggles.hitlGuard).toEqual(DEFAULT_HARNESS_TOGGLES.hitlGuard);
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

      expect(stateStorage.set).toHaveBeenCalledWith({ sessionId: "mission-1" }, state, 600);
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

      expect(fakeExecute).toHaveBeenCalledTimes(1);
      expect(fakeExecute).toHaveBeenCalledWith(
        { query: "hello" },
        expect.objectContaining({ provider, addCostUsd: expect.any(Function) }),
      );
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

    it("records an error observation returned by execute without throwing", async () => {
      const { provider } = makeProvider([
        [{ toolCall: { name: "fake_tool", args: { query: "x" } } }],
        [{ content: "ok" }],
        [{ content: "COMPLETE" }],
      ]);

      fakeExecute.mockResolvedValue({ status: "error", summary: "nope", error: "X" });

      const harness = makeHarness(provider, {
        missionId: "mission-4",
        harnessConfig: { loopDetection: { enabled: false } },
      });

      const packets = await runHarness(harness, makeState("mission-4"));

      expect(fakeExecute).toHaveBeenCalledTimes(1);
      expect(packets.some((p) => p.type === "tool_result" && p.content === "nope (retry 1/3)")).toBe(true);
      expect(packets.some((p) => p.type === "state_change" && p.to === "completed")).toBe(true);
      expect(packets.some((p) => p.type === "degraded")).toBe(false);
    });

    it("passes the behaviorPrompt through to the strategy", async () => {
      const { provider } = makeProvider([[{ content: "COMPLETE" }]]);
      let received: BehaviorPrompt | undefined = undefined;

      const strategy: AgentStrategy = {
        name: "agent",
        buildSystemPrompt: (_state: AgentState, _tools: ToolDefinition[], behaviorPrompt?: BehaviorPrompt | null) => {
          received = behaviorPrompt ?? undefined;

          return "behavior-aware prompt";
        },
      };

      const behaviorPrompt: BehaviorPrompt = {
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
        tools: [FAKE_TOOL],
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
        tools: [FAKE_TOOL],
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

    it("executes only the first of several parallel tool calls", async () => {
      const { provider } = makeProvider([
        [
          { toolCall: { name: "fake_tool", args: { query: "first" } } },
          { toolCall: { name: "fake_tool", args: { query: "second" } } },
        ],
        [{ content: "done" }],
        [{ content: "COMPLETE" }],
      ]);

      await runHarness(makeHarness(provider, { missionId: "mission-parallel" }), makeState("mission-parallel"));

      expect(fakeExecute).toHaveBeenCalledTimes(1);
      expect(fakeExecute).toHaveBeenCalledWith({ query: "first" }, expect.anything());
    });

    it("rejects tool arguments that violate the tool schema without executing it", async () => {
      const strictTool: ToolDefinition = {
        name: "strict_tool",
        description: "Requires a query",
        schema: z.object({ query: z.string() }),
        execute: vi.fn(async () => ({ status: "success" as const, summary: "ran" })),
      };

      const { provider } = makeProvider([
        [{ toolCall: { name: "strict_tool", args: { query: 42 } } }],
        [{ content: "done" }],
        [{ content: "COMPLETE" }],
      ]);

      const harness = new NlahHarness({
        provider,
        strategy: fakeStrategy(),
        missionId: "mission-invalid-args",
        tools: [strictTool],
      });

      const packets = await runHarness(harness, makeState("mission-invalid-args"));

      expect(strictTool.execute).not.toHaveBeenCalled();
      expect(
        packets.some(
          (p) => p.type === "tool_result" && String(p.content).includes("Invalid arguments for tool strict_tool"),
        ),
      ).toBe(true);
    });

    it("skips the stuck classifier when no tool is callable", async () => {
      const { provider, stream } = makeProvider([[{ content: "Answer" }], [{ content: "STUCK" }]]);

      const harness = new NlahHarness({
        provider,
        strategy: fakeStrategy(),
        missionId: "mission-no-tools",
        tools: [],
      });

      const packets = await runHarness(harness, makeState("mission-no-tools"));

      expect(stream).toHaveBeenCalledTimes(1);
      expect(packets.some((p) => p.type === "turn_complete" && p.completed === true)).toBe(true);
    });

    it("reports the latest prompt token count as context usage instead of a running sum", async () => {
      const usage = (promptTokens: number): ProviderEvent => ({
        usage: { promptTokens, completionTokens: 10, totalTokens: promptTokens + 10 },
      });
      const { provider } = makeProvider([
        [{ toolCall: { name: "fake_tool", args: { query: "first" } } }, usage(500)],
        [{ toolCall: { name: "fake_tool", args: { query: "second" } } }, usage(700)],
        [{ content: "done" }],
      ]);

      const packets = await runHarness(makeHarness(provider, { missionId: "mission-ctx" }), makeState("mission-ctx"));

      const progress = packets.filter((p) => p.type === "progress" && p.phase === "tool_execution");
      expect(progress.map((p) => p.tokensUsed)).toEqual([500, 700]);
    });

    it("ends the turn span exactly once when persisting state fails", async () => {
      const span = { id: "span-1", update: vi.fn(), end: vi.fn() };
      const trace = { traceId: "trace-1", startObservation: vi.fn(() => span), update: vi.fn(), end: vi.fn() };
      // SAFETY: Minimal LangfuseSpan stand-in exposing only the members the mission runner calls
      vi.mocked(startAgentTrace).mockReturnValueOnce(trace as never);
      (stateStorage.set as Mock).mockRejectedValueOnce(new Error("redis down"));
      const { provider } = makeProvider([[{ content: "done" }]]);

      await runHarness(makeHarness(provider, { missionId: "mission-span" }), makeState("mission-span")).catch(
        () => undefined,
      );

      expect(span.update).toHaveBeenCalledWith(
        expect.objectContaining({ level: "ERROR", statusMessage: "redis down" }),
      );
      expect(span.end).toHaveBeenCalledTimes(1);
    });
  });
});
