import { Hono } from "hono";
import type Redis from "ioredis";
import { z } from "zod";
import { cancellationManager } from "../../../../../core/agent/harness";
import { stateStorage } from "../../../../../core/agent/storage";
import { toolRegistry } from "../../../../../core/agent/tools";
import { __setRedisClientForTest } from "../../../../../infrastructure/cache/redis";
import { ProviderFactory } from "../../../../../infrastructure/providers/factory";
import type { ToolDefinition } from "../../../../../shared/types";
import { MISSION_ERROR_MESSAGES } from "../mission.constants";
import {
  __setEmptyStreamIdleMsForTest,
  __setPartialHistoryIdleMsForTest,
  createMission,
  handleHitlDecision,
  streamMissionLogs,
} from "../mission.controller";

const mocks = vi.hoisted(() => {
  const runMission = vi.fn();
  class MockNlahHarness {
    runMission = runMission;
    restoreLoopDetectorHistory = vi.fn();
  }
  return {
    runMission,
    MockNlahHarness,
    cancellationManager: {
      register: vi.fn(() => new AbortController().signal),
      unregister: vi.fn(),
      cancelLocal: vi.fn(),
    },
    stateStorage: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    toolRegistry: { resolveTools: vi.fn(), resolveToolsMap: vi.fn(), addRestTool: vi.fn() },
    getImplementedFeatures: vi.fn(),
    createRestTool: vi.fn((_config: unknown) => ({
      name: "api_tool",
      description: "",
      schema: {},
      execute: vi.fn(async () => ({ status: "success", summary: "ok" })),
    })),
    StrategyFactory: { create: vi.fn() },
    strategyRegistry: { resolve: vi.fn() },
    ProviderFactory: { fromConfig: vi.fn() },
    fakeProvider: {
      stream: vi.fn(),
      validate: vi.fn(async () => {}),
      cleanupReasoning: vi.fn(async () => {}),
      maxContextTokens: 128000,
      modelName: "fake-model",
      baseURL: "http://fake.local",
    },
  };
});

vi.mock("../../../../../core/agent/harness", () => ({
  NlahHarness: mocks.MockNlahHarness,
  cancellationManager: mocks.cancellationManager,
}));

vi.mock("../../../../../core/agent/storage", () => ({
  stateStorage: mocks.stateStorage,
}));

vi.mock("../../../../../core/agent/tools", () => ({
  getImplementedFeatures: mocks.getImplementedFeatures,
  toolRegistry: mocks.toolRegistry,
  createRestTool: mocks.createRestTool,
}));

vi.mock("../../../../../core/agent/strategies", () => ({
  StrategyFactory: mocks.StrategyFactory,
  strategyRegistry: mocks.strategyRegistry,
}));

vi.mock("../../../../../infrastructure/providers/factory", () => ({
  ProviderFactory: mocks.ProviderFactory,
}));

vi.mock("../../../../../shared/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), langfuse: vi.fn() },
}));

function buildApp() {
  const app = new Hono();
  app.post("/missions/generate-mission", createMission);
  app.post("/v1/missions/:id/approve", handleHitlDecision);
  app.post("/v1/missions/:id/deny", handleHitlDecision);
  app.get("/v1/missions/:id/stream", streamMissionLogs);
  return app;
}

function postJson(body: unknown) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

const VALID_BODY = {
  missionId: "mission-123",
  prompt: "Write a plan",
  provider_config: {
    type: "openai",
    base_url: "http://localhost:1234",
    model: "gpt-4o",
  },
};

function makePausedState() {
  return {
    state: { missionId: "mission-123", objective: "Write a plan", tasks: [], memory: {}, messages: [] },
    pendingToolCall: { id: "call-1", name: "web_search", args: { query: "news" } },
    harnessSnapshot: {
      strategyName: "nlah",
      toolNames: ["web_search"],
      providerConfig: { type: "openai", base_url: "http://localhost:1234", api_key: null, model: "gpt-4o" },
      delegationDepth: 0,
      featureToggles: {},
    },
    metadata: {
      totalCostUsd: 0,
      loopDetectorHistory: [],
      pausedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    },
  };
}

describe("createMission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stateStorage.get).mockResolvedValue(null);
    vi.mocked(ProviderFactory.fromConfig).mockReturnValue(
      mocks.fakeProvider as unknown as Awaited<ReturnType<typeof ProviderFactory.fromConfig>>,
    );
    vi.mocked(mocks.strategyRegistry.resolve).mockReturnValue({ name: "nlah" });
    vi.mocked(mocks.runMission).mockImplementation(async (_state, onPacket) => {
      await onPacket({ type: "content", missionId: "mission-123", step: 1, content: "hello" });
      await onPacket({ type: "turn_complete", missionId: "mission-123", step: 1, completed: true });
    });
  });

  test("returns 400 with error and details for an invalid body", async () => {
    const app = buildApp();
    const res = await app.request(
      "/missions/generate-mission",
      postJson({ provider_config: VALID_BODY.provider_config }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toBe("Validation Error");
    expect(body.details).toBeDefined();
  });

  test("returns 400 for an unknown feature", async () => {
    vi.mocked(mocks.getImplementedFeatures).mockReturnValue([
      { id: "web_search", name: "Web Search", description: "" },
    ]);
    const app = buildApp();
    const res = await app.request(
      "/missions/generate-mission",
      postJson({ ...VALID_BODY, features: ["unknown-feature"] }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toBe(MISSION_ERROR_MESSAGES.UNKNOWN_FEATURE("unknown-feature"));
  });

  test("streams SSE packets for a valid mission", async () => {
    const app = buildApp();
    const res = await app.request("/missions/generate-mission", postJson(VALID_BODY));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("data:");
    expect(text).toContain("mission-123");
    expect(JSON.parse(text.split("\n\n")[0].slice("data:".length).trim())).toMatchObject({
      type: "content",
      missionId: "mission-123",
      seq: 1,
    });

    expect(mocks.runMission).toHaveBeenCalledWith(
      expect.objectContaining({ missionId: "mission-123" }),
      expect.any(Function),
    );
    expect(cancellationManager.register).toHaveBeenCalledWith("mission-123");
    expect(cancellationManager.unregister).toHaveBeenCalledWith("mission-123");
  });

  test("scopes REST tools to the mission instead of registering them globally", async () => {
    const app = buildApp();
    const res = await app.request(
      "/missions/generate-mission",
      postJson({
        ...VALID_BODY,
        config: {
          restTools: [
            {
              name: "api_tool",
              endpoint: "https://example.com/api",
              method: "GET",
              description: "Calls the example API",
              inputSchema: { type: "object", properties: {} },
            },
          ],
        },
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.createRestTool.mock.calls[0]?.[0]).toMatchObject({
      name: "api_tool",
      endpoint: "https://example.com/api",
      method: "GET",
      description: "Calls the example API",
    });
    // The process-global registry must never be mutated by a mission.
    expect(mocks.toolRegistry.addRestTool).not.toHaveBeenCalled();
  });
});

describe("handleHitlDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stateStorage.get).mockResolvedValue(null);
    vi.mocked(ProviderFactory.fromConfig).mockReturnValue(
      mocks.fakeProvider as unknown as Awaited<ReturnType<typeof ProviderFactory.fromConfig>>,
    );
    vi.mocked(mocks.StrategyFactory.create).mockReturnValue({ name: "nlah" });
    vi.mocked(toolRegistry.resolveTools).mockResolvedValue([]);
    vi.mocked(toolRegistry.resolveToolsMap).mockReturnValue(new Map());
    vi.mocked(mocks.runMission).mockImplementation(async (_state, onPacket) => {
      await onPacket({ type: "content", missionId: "mission-123", step: 1, content: "resumed" });
    });
  });

  test("returns 400 for an invalid decision body", async () => {
    const app = buildApp();
    const res = await app.request("/v1/missions/mission-123/approve", postJson({}));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toBe(MISSION_ERROR_MESSAGES.INVALID_DECISION);
    expect(body.details).toBeDefined();
  });

  test("returns 404 when the approval has expired or is not found", async () => {
    const app = buildApp();
    const res = await app.request(
      "/v1/missions/mission-123/approve",
      postJson({ approvalId: "approval-1", decision: "approve" }),
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toBe(MISSION_ERROR_MESSAGES.APPROVAL_EXPIRED_OR_NOT_FOUND);
  });

  test("resumes execution when an approval is approved", async () => {
    vi.mocked(stateStorage.get).mockResolvedValue(
      makePausedState() as unknown as Awaited<ReturnType<typeof stateStorage.get>>,
    );
    const toolExecute = vi.fn(async () => ({ status: "success", summary: "search result" }));
    vi.mocked(toolRegistry.resolveToolsMap).mockReturnValue(
      new Map<string, ToolDefinition>([
        [
          "web_search",
          {
            name: "web_search",
            description: "",
            keywords: [],
            schema: z.object({ query: z.string() }),
            execute: toolExecute as unknown as ToolDefinition["execute"],
          },
        ],
      ]),
    );

    const app = buildApp();
    const res = await app.request(
      "/v1/missions/mission-123/approve",
      postJson({ approvalId: "approval-1", decision: "approve" }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("resumed");
    expect(stateStorage.delete).toHaveBeenCalledWith("paused:approval-1");
    expect(toolExecute).toHaveBeenCalledWith({ query: "news" });
    expect(mocks.StrategyFactory.create).toHaveBeenCalledWith("nlah");
  });

  test("resumes execution when an approval is denied", async () => {
    vi.mocked(stateStorage.get).mockResolvedValue(
      makePausedState() as unknown as Awaited<ReturnType<typeof stateStorage.get>>,
    );

    const app = buildApp();
    const res = await app.request(
      "/v1/missions/mission-123/deny",
      postJson({ approvalId: "approval-1", decision: "deny", reason: "not allowed" }),
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("resumed");
    expect(stateStorage.delete).toHaveBeenCalledWith("paused:approval-1");
    // Both approve and deny resumes restore the pre-pause tool allowlist
    // (strict allowlist: resumed harness must not fall back to retriever tools).
    expect(toolRegistry.resolveToolsMap).toHaveBeenCalledWith(["web_search"]);
  });
});

describe("streamMissionLogs", () => {
  type FakeRedis = Pick<Redis, "xrange" | "xrevrange" | "xread">;

  function fakeRedis(overrides: Partial<FakeRedis>): FakeRedis {
    return {
      xrange: vi.fn().mockResolvedValue([]),
      xrevrange: vi.fn().mockResolvedValue([]),
      xread: vi.fn().mockResolvedValue(null),
      ...overrides,
    } as unknown as FakeRedis;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    __setRedisClientForTest(null, false);
    __setEmptyStreamIdleMsForTest(null);
  });

  test("replays history and closes the stream when a live terminal packet arrives", async () => {
    const historySid = "1699999999999-0";
    const redis = fakeRedis({
      xrange: vi.fn().mockResolvedValue([[historySid, ["p", '{"type":"content","content":"a"}']]]),
      xrevrange: vi.fn().mockResolvedValue([]),
      xread: vi
        .fn()
        .mockResolvedValueOnce([
          ["mission:events:m-1", [["1699999999999-2", ["p", '{"type":"mission_completed","missionId":"m-1"}']]]],
        ])
        .mockResolvedValue(null),
    });
    __setRedisClientForTest(redis as unknown as Redis, true);

    const app = buildApp();
    const res = await app.request("/v1/missions/m-1/stream");

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"type":"content"');
    expect(text).toContain('"type":"mission_completed"');
    // The replay_done marker must separate the replayed history from the
    // live terminal packet so the recovery client can switch to live mode.
    expect(text.indexOf('"type":"replay_done"')).toBeGreaterThan(text.indexOf('"type":"content"'));
    expect(text.indexOf('"type":"replay_done"')).toBeLessThan(text.indexOf('"type":"mission_completed"'));

    // Subscribe resumes from the last replayed entry, not from the tail, so
    // events recorded between the history read and the first XREAD are not lost.
    expect(redis.xread).toHaveBeenCalledWith("COUNT", 100, "BLOCK", 5000, "STREAMS", "mission:events:m-1", historySid);
  });

  test("closes immediately when the terminal marker is already in history", async () => {
    const redis = fakeRedis({
      xrange: vi.fn().mockResolvedValue([["1699999999999-0", ["p", '{"type":"mission_completed","missionId":"m-1"}']]]),
      xrevrange: vi
        .fn()
        .mockResolvedValue([["1699999999999-0", ["p", '{"type":"mission_completed","missionId":"m-1"}']]]),
    });
    __setRedisClientForTest(redis as unknown as Redis, true);

    const app = buildApp();
    const res = await app.request("/v1/missions/m-1/stream");

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"type":"mission_completed"');
    expect(redis.xread).not.toHaveBeenCalled();
  });

  test("closes after an idle window when the mission stream is empty (expired TTL)", async () => {
    const redis = fakeRedis({});
    __setRedisClientForTest(redis as unknown as Redis, true);
    __setEmptyStreamIdleMsForTest(20);

    const app = buildApp();
    const res = await app.request("/v1/missions/m-1/stream");

    expect(res.status).toBe(200);
    const text = await res.text();
    // The empty stream still signals the end of replay before closing on the
    // idle timer; no live packets are present.
    expect(text).toContain('"type":"replay_done"');
    expect(text).not.toContain('"type":"content"');
  });

  test("cancels the idle close when the first live event arrives", async () => {
    const terminal = [
      ["mission:events:m-1", [["1699999999999-6", ["p", '{"type":"mission_completed","missionId":"m-1"}']]]],
    ];
    const redis = fakeRedis({
      xrange: vi.fn().mockResolvedValue([]),
      xrevrange: vi.fn().mockResolvedValue([]),
      // First live event arrives immediately; the terminal arrives only after
      // the idle window would have fired. If the idle timer is not cancelled on
      // the first event, the stream closes early and the terminal is lost.
      xread: vi
        .fn()
        .mockResolvedValueOnce([
          ["mission:events:m-1", [["1699999999999-5", ["p", '{"type":"content","content":"b"}']]]],
        ])
        .mockReturnValueOnce(new Promise((resolve) => setTimeout(() => resolve(terminal), 40))),
    });
    __setRedisClientForTest(redis as unknown as Redis, true);
    __setEmptyStreamIdleMsForTest(20);

    const app = buildApp();
    const res = await app.request("/v1/missions/m-1/stream");

    const text = await res.text();
    expect(text).toContain('"type":"content"');
    expect(text).toContain('"type":"mission_completed"');
  });

  test("closes a partial-history stream when the agent died mid-run (sliding idle window)", async () => {
    __setEmptyStreamIdleMsForTest(null);
    const redis = fakeRedis({
      // Some events recorded, but no terminal marker — e.g. the agent crashed.
      xrange: vi.fn().mockResolvedValue([["1699999999999-0", ["p", '{"type":"content","content":"a"}']]]),
      xrevrange: vi.fn().mockResolvedValue([]),
      // No further live events ever arrive.
      xread: vi.fn().mockResolvedValue(null),
    });
    __setRedisClientForTest(redis as unknown as Redis, true);
    __setPartialHistoryIdleMsForTest(20);

    const app = buildApp();
    const res = await app.request("/v1/missions/m-1/stream");

    const text = await res.text();
    // History replayed, then the stream closes on the idle window instead of
    // blocking forever on XREAD.
    expect(text).toContain('"type":"content"');
    expect(text).toContain('"type":"replay_done"');
  });

  test("returns 503 when redis is unavailable", async () => {
    __setRedisClientForTest(null, false);
    const app = buildApp();
    const res = await app.request("/v1/missions/m-1/stream");
    expect(res.status).toBe(503);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: MISSION_ERROR_MESSAGES.STREAM_UNAVAILABLE,
    });
  });
});
