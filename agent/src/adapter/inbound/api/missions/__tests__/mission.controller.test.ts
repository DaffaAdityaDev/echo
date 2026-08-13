import { Hono } from "hono";
import { z } from "zod";
import { cancellationManager } from "../../../../../core/agent/harness";
import { stateStorage } from "../../../../../core/agent/storage";
import { toolRegistry } from "../../../../../core/agent/tools";
import { ProviderFactory } from "../../../../../infrastructure/providers/factory";
import type { ToolDefinition } from "../../../../../shared/types";
import { MISSION_ERROR_MESSAGES } from "../mission.constants";
import { createMission, handleHitlDecision } from "../mission.controller";

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
      clearCancelled: vi.fn(),
      isCancelled: vi.fn(() => false),
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
    isProviderConnectionConfig: (value: unknown) => {
      const cfg = value as Record<string, unknown> | null;
      return (
        typeof cfg === "object" &&
        cfg !== null &&
        typeof cfg.type === "string" &&
        typeof cfg.base_url === "string" &&
        typeof cfg.model === "string"
      );
    },
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
  isProviderConnectionConfig: mocks.isProviderConnectionConfig,
}));

vi.mock("../../../../../shared/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), langfuse: vi.fn() },
}));

function buildApp() {
  const app = new Hono();
  app.post("/missions/generate-mission", createMission);
  app.post("/v1/sessions/:id/approve", handleHitlDecision);
  app.post("/v1/sessions/:id/deny", handleHitlDecision);
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
  sessionId: "mission-123",
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
    const res = await app.request("/v1/sessions/mission-123/approve", postJson({}));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toBe(MISSION_ERROR_MESSAGES.INVALID_DECISION);
    expect(body.details).toBeDefined();
  });

  test("returns 404 when the approval has expired or is not found", async () => {
    const app = buildApp();
    const res = await app.request(
      "/v1/sessions/mission-123/approve",
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
      "/v1/sessions/mission-123/approve",
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
      "/v1/sessions/mission-123/deny",
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
