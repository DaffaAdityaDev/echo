import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { serializeAgentState } from "../../../../core/agent/storage";
import type { AgentState } from "../../../../shared/types";
import { MemoryAdapter } from "../memory.adapter";

vi.mock("../../../../shared/utils/jwt", () => ({
  signServiceJwt: vi.fn(() => "fake-token"),
}));

vi.mock("../../../../config/env", () => ({
  ENV: { BACKEND_URL: "", STATE_BACKEND: "memory" },
}));

vi.mock("../../../../shared/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeState(): AgentState {
  return {
    missionId: "m1",
    objective: "Test objective",
    tasks: [],
    memory: {},
    messages: [],
  };
}

describe("MemoryAdapter", () => {
  const baseUrl = "http://test-backend:8080";
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test("constructor uses the provided baseUrl", () => {
    const adapter = new MemoryAdapter(baseUrl);
    expect(adapter.getClient()).toBe(baseUrl);
  });

  test("constructor falls back to the default baseUrl", () => {
    const adapter = new MemoryAdapter();
    expect(adapter.getClient()).toBe("http://localhost:8080");
  });

  describe("connect", () => {
    test("marks the adapter connected when health check succeeds", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const adapter = new MemoryAdapter(baseUrl);
      await expect(adapter.connect()).resolves.toBeUndefined();
      expect(adapter.isConnected()).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(`${baseUrl}/health`, expect.objectContaining({ method: "GET" }));
    });

    test("rejects when the health check fails", async () => {
      fetchMock.mockRejectedValue(new Error("network down"));
      const adapter = new MemoryAdapter(baseUrl);
      await expect(adapter.connect()).rejects.toThrow("Cannot connect to backend");
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe("disconnect", () => {
    test("marks the adapter disconnected", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const adapter = new MemoryAdapter(baseUrl);
      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
      adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe("health", () => {
    test("returns ok with latency when fetch succeeds", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const adapter = new MemoryAdapter(baseUrl);
      const result = await adapter.health();
      expect(result.ok).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    test("returns not ok when fetch rejects", async () => {
      fetchMock.mockRejectedValue(new Error("boom"));
      const adapter = new MemoryAdapter(baseUrl);
      const result = await adapter.health();
      expect(result.ok).toBe(false);
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe("get", () => {
    test("returns the deserialized state from entries", async () => {
      const serialized = serializeAgentState({
        ...makeState(),
        messages: [new HumanMessage({ content: "hi" }), new AIMessage({ content: "yo" })],
      });
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            session_id: "m1",
            entries: [{ content: JSON.stringify(serialized), timestamp: "2026-08-05T00:00:00Z" }],
            total: 1,
          }),
          { status: 200 },
        ),
      );
      const adapter = new MemoryAdapter(baseUrl);
      const result = await adapter.get("m1");
      expect(result).not.toBeNull();
      expect(result?.missionId).toBe("m1");
      expect(result?.objective).toBe("Test objective");
      expect(result?.messages).toHaveLength(2);
      expect(result?.messages[0]).toBeInstanceOf(HumanMessage);
      expect(result?.messages[1]).toBeInstanceOf(AIMessage);
      expect(result?.messages[0].content).toBe("hi");
    });

    test("joins multiple entry contents", async () => {
      const serialized = serializeAgentState(makeState());
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            session_id: "m1",
            entries: [
              { content: JSON.stringify(serialized), timestamp: "2026-08-05T00:00:00Z" },
              { content: JSON.stringify(serialized), timestamp: "2026-08-05T00:00:01Z" },
            ],
            total: 2,
          }),
          { status: 200 },
        ),
      );
      const adapter = new MemoryAdapter(baseUrl);
      const result = await adapter.get("m1");
      expect(result).not.toBeNull();
      expect(result?.missionId).toBe("m1");
    });

    test("falls back to legacy top-level content", async () => {
      const serialized = serializeAgentState(makeState());
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ content: JSON.stringify(serialized) }), { status: 200 }),
      );
      const adapter = new MemoryAdapter(baseUrl);
      const result = await adapter.get("m1");
      expect(result).not.toBeNull();
      expect(result?.missionId).toBe("m1");
    });

    test("returns null when content is empty", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ content: "" }), { status: 200 }));
      const adapter = new MemoryAdapter(baseUrl);
      await expect(adapter.get("m1")).resolves.toBeNull();
    });

    test("returns null when content is absent", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const adapter = new MemoryAdapter(baseUrl);
      await expect(adapter.get("m1")).resolves.toBeNull();
    });

    test("returns null when the request rejects", async () => {
      fetchMock.mockRejectedValue(new Error("network down"));
      const adapter = new MemoryAdapter(baseUrl);
      await expect(adapter.get("m1")).resolves.toBeNull();
    });

    test("returns null when content is not valid JSON", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ content: "{not json" }), { status: 200 }));
      const adapter = new MemoryAdapter(baseUrl);
      await expect(adapter.get("m1")).resolves.toBeNull();
    });
  });

  describe("set", () => {
    test("rejects when the backend request fails", async () => {
      fetchMock.mockResolvedValue(new Response("backend exploded", { status: 500 }));
      const adapter = new MemoryAdapter(baseUrl);
      await expect(adapter.set("m1", makeState())).rejects.toThrow("Memory request failed: 500 backend exploded");
    });

    test("posts serialized state with session id and content", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const adapter = new MemoryAdapter(baseUrl);
      await adapter.set("m1", makeState(), 3600);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe(`${baseUrl}/api/v1/internal/memory/episodic/store`);
      expect(options.method).toBe("POST");
      expect(options.headers.Authorization).toBe("Bearer fake-token");
      expect(options.headers["Content-Type"]).toBe("application/json");
      const body = JSON.parse(options.body);
      expect(body.session_id).toBe("m1");
      expect(body.ttl_seconds).toBe(3600);
      const parsed = JSON.parse(body.content);
      expect(parsed.missionId).toBe("m1");
      expect(parsed.messages).toEqual([]);
    });

    test("omits ttl_seconds when not provided", async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      const adapter = new MemoryAdapter(baseUrl);
      await adapter.set("m1", makeState());
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.ttl_seconds).toBeUndefined();
    });
  });

  describe("delete", () => {
    test("resolves without performing a request", async () => {
      fetchMock.mockRejectedValue(new Error("should not be called"));
      const adapter = new MemoryAdapter(baseUrl);
      await expect(adapter.delete("m1")).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
