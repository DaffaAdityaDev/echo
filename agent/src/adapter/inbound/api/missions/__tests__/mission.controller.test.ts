import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { Hono } from "hono";
import { z } from "zod";
import { cancellationManager } from "../../../../../core/agent/harness";
import { stateStorage } from "../../../../../core/agent/storage";
import { toolRegistry } from "../../../../../core/agent/tools";
import { ProviderFactory } from "../../../../../infrastructure/providers/factory";
import type { AgentState, JsonValue, ToolDefinition } from "../../../../../shared/types";
import type { RestToolConfig } from "../../../../../infrastructure/transports/rest/types";
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
      isActive: vi.fn(() => false),
      cancelLocal: vi.fn(),
      clearCancelled: vi.fn(),
      isCancelled: vi.fn(() => false),
    },
    stateStorage: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    toolRegistry: { resolveTools: vi.fn(), resolveToolsMap: vi.fn(), addRestTool: vi.fn() },
    getImplementedFeatures: vi.fn(),
    createRestTool: vi.fn((_config: RestToolConfig) => ({
      name: "api_tool",
      description: "",
      schema: {},
      execute: vi.fn(async () => ({ status: "success", summary: "ok" })),
    })),
    StrategyFactory: { create: vi.fn() },
    strategyRegistry: { resolve: vi.fn() },
    ProviderFactory: { fromConfig: vi.fn() },
    isProviderConnectionConfig: (value: JsonValue | null | undefined) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const cfg = value as Record<string, JsonValue>;

      return typeof cfg.type === "string" && typeof cfg.base_url === "string" && typeof cfg.model === "string";
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

function postJson(body: JsonValue) {
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
    missionId: "mission-123",
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
    // SAFETY: Mock provider for mission creation test
    vi.mocked(ProviderFactory.fromConfig).mockReturnValue(mocks.fakeProvider as never);
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
    expect(cancellationManager.unregister).toHaveBeenCalledWith("mission-123", expect.any(AbortSignal));
  });

  test("rejects a second concurrent run on the same session with 409", async () => {
    vi.mocked(cancellationManager.isActive).mockReturnValueOnce(true);
    const app = buildApp();
    const res = await app.request("/missions/generate-mission", postJson(VALID_BODY));

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(MISSION_ERROR_MESSAGES.MISSION_ALREADY_RUNNING);
    expect(cancellationManager.register).not.toHaveBeenCalled();
    expect(mocks.runMission).not.toHaveBeenCalled();
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

  test("appends a repeated prompt when it is not the latest message", async () => {
    const existing: AgentState = {
      missionId: "mission-123",
      objective: "yes",
      tasks: [],
      memory: {},
      messages: [new HumanMessage("yes"), new AIMessage("Shall I continue?")],
    };
    vi.mocked(stateStorage.get).mockResolvedValue(existing);

    const res = await buildApp().request("/missions/generate-mission", postJson({ ...VALID_BODY, prompt: "yes" }));
    await res.text();

    const state = vi.mocked(mocks.runMission).mock.calls[0][0] as AgentState;
    expect(state.messages.map((m) => String(m.content))).toEqual(["yes", "Shall I continue?", "yes"]);
  });

  test("does not duplicate a retried prompt that is already the latest message", async () => {
    const existing: AgentState = {
      missionId: "mission-123",
      objective: "yes",
      tasks: [],
      memory: {},
      messages: [new HumanMessage("yes")],
    };
    vi.mocked(stateStorage.get).mockResolvedValue(existing);

    const res = await buildApp().request("/missions/generate-mission", postJson({ ...VALID_BODY, prompt: "yes" }));
    await res.text();

    const state = vi.mocked(mocks.runMission).mock.calls[0][0] as AgentState;
    expect(state.messages).toHaveLength(1);
  });
});

describe("handleHitlDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stateStorage.get).mockResolvedValue(null);
    // SAFETY: Mock provider for mission approval test
    vi.mocked(ProviderFactory.fromConfig).mockReturnValue(mocks.fakeProvider as never);
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

  function mockWebSearchTool(execute: ToolDefinition["execute"]) {
    vi.mocked(toolRegistry.resolveToolsMap).mockReturnValue(
      new Map<string, ToolDefinition>([
        [
          "web_search",
          { name: "web_search", description: "", keywords: [], schema: z.object({ query: z.string() }), execute },
        ],
      ]),
    );
  }

  test("returns a retryable 409 without consuming the approval while the session's run is still active", async () => {
    vi.mocked(cancellationManager.isActive).mockReturnValueOnce(true);
    // SAFETY: Mock paused execution state fixture
    vi.mocked(stateStorage.get).mockResolvedValue(makePausedState() as never);

    const app = buildApp();

    const res = await app.request(
      "/v1/sessions/mission-123/approve",
      postJson({ approvalId: "approval-busy", decision: "approve" }),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(MISSION_ERROR_MESSAGES.MISSION_ALREADY_RUNNING);
    expect(stateStorage.get).not.toHaveBeenCalled();
    expect(stateStorage.delete).not.toHaveBeenCalled();
    expect(cancellationManager.register).not.toHaveBeenCalled();
  });

  test("releases the reserved run slot when the approval is not found", async () => {
    const app = buildApp();

    const res = await app.request(
      "/v1/sessions/mission-123/approve",
      postJson({ approvalId: "approval-missing", decision: "approve" }),
    );

    expect(res.status).toBe(404);
    expect(cancellationManager.register).toHaveBeenCalledWith("mission-123");
    expect(cancellationManager.unregister).toHaveBeenCalledWith("mission-123", expect.any(AbortSignal));
  });

  test("keeps the approval claimable when deleting the paused state fails", async () => {
    // SAFETY: Mock paused execution state fixture
    vi.mocked(stateStorage.get).mockResolvedValue(makePausedState() as never);
    vi.mocked(stateStorage.delete).mockRejectedValueOnce(new Error("backend down"));
    const toolExecute = vi.fn(async () => ({ status: "success" as const, summary: "search result" }));
    mockWebSearchTool(toolExecute);

    const app = buildApp();
    const request = () =>
      app.request("/v1/sessions/mission-123/approve", postJson({ approvalId: "approval-retry", decision: "approve" }));

    const failed = await request();
    expect(failed.status).toBe(500);
    expect(cancellationManager.unregister).toHaveBeenCalledWith("mission-123", expect.any(AbortSignal));

    const retried = await request();
    await retried.text();
    expect(retried.status).toBe(200);
    expect(toolExecute).toHaveBeenCalledTimes(1);
  });

  test("returns 404 when the approval belongs to another session", async () => {
    // SAFETY: Mock paused execution state fixture
    vi.mocked(stateStorage.get).mockResolvedValue(makePausedState() as never);
    const toolExecute = vi.fn(async () => ({ status: "success" as const, summary: "search result" }));
    mockWebSearchTool(toolExecute);

    const app = buildApp();

    const res = await app.request(
      "/v1/sessions/other-session/approve",
      postJson({ approvalId: "approval-cross", decision: "approve" }),
    );

    expect(res.status).toBe(404);
    expect(toolExecute).not.toHaveBeenCalled();
    expect(stateStorage.delete).not.toHaveBeenCalled();
  });

  test("executes the approved tool once when two decisions race for the same approval", async () => {
    // SAFETY: Mock paused execution state fixture
    vi.mocked(stateStorage.get).mockResolvedValue(makePausedState() as never);
    const toolExecute = vi.fn(async () => ({ status: "success" as const, summary: "search result" }));
    mockWebSearchTool(toolExecute);

    const app = buildApp();
    const request = () =>
      app.request("/v1/sessions/mission-123/approve", postJson({ approvalId: "approval-race", decision: "approve" }));

    const [first, second] = await Promise.all([request(), request()]);
    await Promise.all([first.text(), second.text()]);

    expect([first.status, second.status].sort()).toEqual([200, 404]);
    expect(toolExecute).toHaveBeenCalledTimes(1);
  });

  test("rejects approved tool arguments that violate the tool schema", async () => {
    const paused = makePausedState();
    paused.pendingToolCall.args = { query: 7 } as never;
    // SAFETY: Mock paused execution state fixture
    vi.mocked(stateStorage.get).mockResolvedValue(paused as never);
    const toolExecute = vi.fn(async () => ({ status: "success" as const, summary: "search result" }));
    mockWebSearchTool(toolExecute);

    const app = buildApp();

    const res = await app.request(
      "/v1/sessions/mission-123/approve",
      postJson({ approvalId: "approval-invalid", decision: "approve" }),
    );

    expect(res.status).toBe(200);
    await res.text();
    expect(toolExecute).not.toHaveBeenCalled();
    const resumedState = vi.mocked(mocks.runMission).mock.calls[0][0] as AgentState;
    const toolMessage = resumedState.messages[resumedState.messages.length - 1];
    expect(String(toolMessage.content)).toContain("Invalid arguments for tool web_search");
  });

  test("resumes with an error observation when the approved tool throws", async () => {
    // SAFETY: Mock paused execution state fixture
    vi.mocked(stateStorage.get).mockResolvedValue(makePausedState() as never);
    mockWebSearchTool(
      vi.fn(async () => {
        throw new Error("upstream exploded");
      }),
    );

    const app = buildApp();

    const res = await app.request(
      "/v1/sessions/mission-123/approve",
      postJson({ approvalId: "approval-throws", decision: "approve" }),
    );

    expect(res.status).toBe(200);
    await res.text();
    const resumedState = vi.mocked(mocks.runMission).mock.calls[0][0] as AgentState;
    const toolMessage = resumedState.messages[resumedState.messages.length - 1];
    expect(String(toolMessage.content)).toContain("upstream exploded");
  });

  test("resumes execution when an approval is approved", async () => {
    // SAFETY: Mock paused execution state fixture
    vi.mocked(stateStorage.get).mockResolvedValue(makePausedState() as never);
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
            // SAFETY: Mock tool execute implementation
            execute: toolExecute as never,
          },
        ],
      ]),
    );

    const app = buildApp();

    const res = await app.request(
      "/v1/sessions/mission-123/approve",
      postJson({ approvalId: "approval-approve", decision: "approve" }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("resumed");
    expect(stateStorage.get).toHaveBeenCalledWith({ sessionId: "mission-123", slot: "paused:approval-approve" });
    expect(stateStorage.delete).toHaveBeenCalledWith({ sessionId: "mission-123", slot: "paused:approval-approve" });
    expect(toolExecute).toHaveBeenCalledWith({ query: "news" });
    expect(mocks.StrategyFactory.create).toHaveBeenCalledWith("nlah");
  });

  test("resumes execution when an approval is denied", async () => {
    // SAFETY: Mock paused execution state fixture
    vi.mocked(stateStorage.get).mockResolvedValue(makePausedState() as never);

    const app = buildApp();

    const res = await app.request(
      "/v1/sessions/mission-123/deny",
      postJson({ approvalId: "approval-deny", decision: "deny", reason: "not allowed" }),
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("resumed");
    expect(stateStorage.delete).toHaveBeenCalledWith({ sessionId: "mission-123", slot: "paused:approval-deny" });
    // Both approve and deny resumes restore the pre-pause tool allowlist
    // (strict allowlist: resumed harness must not fall back to retriever tools).
    expect(toolRegistry.resolveToolsMap).toHaveBeenCalledWith(["web_search"]);
  });
});
