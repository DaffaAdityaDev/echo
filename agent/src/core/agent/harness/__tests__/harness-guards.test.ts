import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { Mock } from "vitest";
import type { JsonObject, JsonValue, ProviderEvent } from "../../../../shared/types";
import { stateStorage } from "../../storage/factory";
import type { StateKey } from "../../storage/state-key";
import { cancellationManager } from "../cancel-manager";
import { HARNESS_CONFIG } from "../constants";
import { LoopDetector } from "../loop-detector";
import {
  fakeExecute,
  makeHarness,
  makeProvider,
  makeState,
  resetFakeExecute,
  runHarness,
  type TestPacket,
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

type ApprovalPayload = {
  approvalId: string;
  toolName: string;
  args: JsonObject;
  riskLevel: string;
  expiresAt: number;
};

describe("NlahHarness runMission guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (stateStorage.get as Mock).mockReset();
    (stateStorage.get as Mock).mockResolvedValue(null);
    resetFakeExecute();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

    fakeExecute.mockImplementation(async () => {
      throw new Error("boom");
    });

    const harness = makeHarness(provider, {
      missionId: "mission-3",
      harnessConfig: { loopDetection: { enabled: false } },
    });

    const packets = await runHarness(harness, makeState("mission-3"));

    expect(fakeExecute).toHaveBeenCalledTimes(3);
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

  it("pauses for HITL approval on a protected tool and stops awaiting approval", async () => {
    const { provider, stream } = makeProvider([
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

    const approvalPayload = approval?.payload as ApprovalPayload;

    expect(String(approvalPayload.approvalId)).toMatch(/^appr_/);
    expect(approvalPayload.toolName).toBe("fake_tool");
    expect(approvalPayload.args).toEqual({ query: "delete it" });
    expect(approvalPayload.riskLevel).toBe("high");
    expect(typeof approvalPayload.expiresAt).toBe("number");

    const pausedCall = (stateStorage.set as Mock).mock.calls.find((call) => String(call[0].slot).startsWith("paused:"));
    expect(pausedCall).toBeDefined();
    expect((pausedCall as [StateKey, unknown, number])[0].sessionId).toBe("mission-5");
    expect((pausedCall as [StateKey, unknown, number])[1]).toEqual(
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

    expect(fakeExecute).not.toHaveBeenCalled();
    expect(stream).toHaveBeenCalledTimes(1);
    expect(packets.filter((p) => p.type === "hitl_approval_required")).toHaveLength(1);
    expect(packets.some((p) => p.type === "state_change" && p.to === "awaiting_approval")).toBe(true);
    expect(packets.some((p) => p.type === "state_change" && p.to === "completed")).toBe(false);
    expect(packets.some((p) => p.type === "turn_complete" && p.completed === false)).toBe(true);
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
      { sessionId: "mission-6" },
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

    expect(fakeExecute).toHaveBeenCalledTimes(1);
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

    expect(fakeExecute).toHaveBeenCalledTimes(2);
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

    expect(fakeExecute).not.toHaveBeenCalled();
    expect(
      packets.some((p) => p.type === "system_notice" && (p.payload as { code?: string }).code === "LOOP_DETECTED"),
    ).toBe(true);
    expect(packets.some((p) => p.type === "state_change" && p.to === "completed")).toBe(true);
  });

  it("does not report completed after a budget abort", async () => {
    const { provider } = makeProvider([[{ content: "unused" }]]);

    const harness = makeHarness(provider, {
      missionId: "mission-budget",
      harnessConfig: { budgetMonitor: { enabled: true, enforceMaxSteps: true, maxSteps: 1 } },
    });

    const packets = await runHarness(harness, makeState("mission-budget"));

    expect(packets.some((p) => p.type === "state_change" && p.to === "aborted")).toBe(true);
    expect(packets.some((p) => p.type === "state_change" && p.to === "completed")).toBe(false);
    expect(packets.some((p) => p.type === "turn_complete" && p.completed === false)).toBe(true);
  });

  it("records a loop intervention as a human notice, never an orphan ToolMessage", async () => {
    const { provider } = makeProvider([
      [{ toolCall: { name: "fake_tool", args: { query: "x" } } }],
      [{ toolCall: { name: "fake_tool", args: { query: "x" } } }],
      [{ toolCall: { name: "fake_tool", args: { query: "x" } } }],
      [{ content: "COMPLETE" }],
    ]);

    const state = makeState("mission-loop-msg");
    await runHarness(makeHarness(provider, { missionId: "mission-loop-msg" }), state);

    const announcedIds = new Set(
      state.messages.flatMap((m) => (m instanceof AIMessage ? (m.tool_calls ?? []).map((tc) => tc.id) : [])),
    );
    const toolMessages = state.messages.filter((m): m is ToolMessage => m instanceof ToolMessage);

    expect(toolMessages).toHaveLength(2);
    expect(toolMessages.every((m) => announcedIds.has(m.tool_call_id))).toBe(true);
    expect(state.messages.some((m) => String(m.content).startsWith("SYSTEM INTERVENTION"))).toBe(true);
  });

  it("stops offering tools and warns once after the pacing threshold", async () => {
    const toolTurn: ProviderEvent[] = [{ toolCall: { name: "fake_tool", args: { query: "q" } } }];
    const script: ProviderEvent[][] = [];

    for (let i = 0; i < HARNESS_CONFIG.PACING_THRESHOLD; i++) {
      script.push([{ toolCall: { name: "fake_tool", args: { query: `q${i}` } } }]);
    }

    script.push(toolTurn, [{ content: "final" }], [{ content: "COMPLETE" }]);
    const { provider, stream } = makeProvider(script);

    const state = makeState("mission-pacing");
    await runHarness(
      makeHarness(provider, {
        missionId: "mission-pacing",
        harnessConfig: { budgetMonitor: { enabled: false } },
      }),
      state,
    );

    const pacedCall = stream.mock.calls[HARNESS_CONFIG.PACING_THRESHOLD];
    expect(pacedCall[1]).toEqual([]);
    expect(state.messages.filter((m) => String(m.content).includes("SYSTEM FORCED SYNTHESIS"))).toHaveLength(1);
  });
});
