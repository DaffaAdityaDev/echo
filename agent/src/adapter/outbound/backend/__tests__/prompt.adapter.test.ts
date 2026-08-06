import type Redis from "ioredis";
import { type ActivePrompt, PromptAdapter } from "../prompt.adapter";

vi.mock("../../../../shared/utils/jwt", () => ({
  signServiceJwt: vi.fn(() => "fake-token"),
}));

vi.mock("../../../../config/env", () => ({
  ENV: { BACKEND_URL: "" },
}));

vi.mock("../../../../shared/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeResponse(overrides: Record<string, unknown> = {}, status = 200): Response {
  return new Response(
    JSON.stringify({
      id: "p1",
      template_id: "t1",
      version: 3,
      system_prompt: "You are a test agent.",
      bound_tools: ["web_search", "write_todos"],
      variables: ["objective"],
      status: "active",
      created_at: "2026-08-05T00:00:00Z",
      ...overrides,
    }),
    { status },
  );
}

function stubRedis(overrides: Partial<Pick<Redis, "get" | "set">> = {}): Redis {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    ...overrides,
  } as unknown as Redis;
}

describe("PromptAdapter", () => {
  const baseUrl = "http://test-backend:8080";
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test("maps a 200 response from snake_case to camelCase", async () => {
    fetchMock.mockResolvedValue(makeResponse());
    const adapter = new PromptAdapter({ baseUrl, redis: stubRedis() });

    const result = await adapter.getActivePrompt("main", "tenant-1");

    expect(result).toEqual({
      version: 3,
      systemPrompt: "You are a test agent.",
      boundTools: ["web_search", "write_todos"],
      variables: ["objective"],
    });
  });

  test("requests the active prompt endpoint with tenant and auth headers", async () => {
    fetchMock.mockResolvedValue(makeResponse());
    const adapter = new PromptAdapter({ baseUrl, redis: stubRedis() });

    await adapter.getActivePrompt("main", "tenant-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${baseUrl}/api/v1/internal/prompts/active?template=main`);
    expect(options.method).toBe("GET");
    expect(options.headers["X-Tenant-ID"]).toBe("tenant-1");
    expect(options.headers.Authorization).toBe("Bearer fake-token");
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  test.each([400, 401, 403, 404, 500])("returns null on non-200 status %s", async (status) => {
    fetchMock.mockResolvedValue(new Response("nope", { status }));
    const adapter = new PromptAdapter({ baseUrl, redis: stubRedis() });

    await expect(adapter.getActivePrompt("main", "tenant-1")).resolves.toBeNull();
  });

  test("returns null when the network request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const adapter = new PromptAdapter({ baseUrl, redis: stubRedis() });

    await expect(adapter.getActivePrompt("main", "tenant-1")).resolves.toBeNull();
  });

  test("returns null on a malformed 200 payload", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "active" }), { status: 200 }));
    const adapter = new PromptAdapter({ baseUrl, redis: stubRedis() });

    await expect(adapter.getActivePrompt("main", "tenant-1")).resolves.toBeNull();
  });

  test("works without redis and skips caching entirely", async () => {
    fetchMock.mockResolvedValue(makeResponse());
    const adapter = new PromptAdapter({ baseUrl, redis: null });

    await adapter.getActivePrompt("main", "tenant-1");
    await adapter.getActivePrompt("main", "tenant-1");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("returns a cached prompt without hitting the network", async () => {
    const cached: ActivePrompt = {
      version: 9,
      systemPrompt: "Cached prompt",
      boundTools: [],
      variables: [],
    };
    const redis = stubRedis({ get: vi.fn().mockResolvedValue(JSON.stringify(cached)) });
    const adapter = new PromptAdapter({ baseUrl, redis });

    const result = await adapter.getActivePrompt("main", "tenant-1");

    expect(result).toEqual(cached);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("stores a successful fetch in the cache with a 60s TTL", async () => {
    fetchMock.mockResolvedValue(makeResponse());
    const redis = stubRedis();
    const adapter = new PromptAdapter({ baseUrl, redis });

    await adapter.getActivePrompt("main", "tenant-1");

    expect(redis.set).toHaveBeenCalledTimes(1);
    const [key, value, mode, ttl] = vi.mocked(redis.set).mock.calls[0] as unknown as [string, string, string, number];
    expect(key).toBe("agent:prompts:tenant-1:main");
    expect(JSON.parse(String(value))).toEqual({
      version: 3,
      systemPrompt: "You are a test agent.",
      boundTools: ["web_search", "write_todos"],
      variables: ["objective"],
    });
    expect(mode).toBe("EX");
    expect(ttl).toBe(60);
  });

  test("does not cache when the fetch fails", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 404 }));
    const redis = stubRedis();
    const adapter = new PromptAdapter({ baseUrl, redis });

    await adapter.getActivePrompt("main", "tenant-1");

    expect(redis.set).not.toHaveBeenCalled();
  });
});
