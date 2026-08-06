import type Redis from "ioredis";
import { PromptAdapter } from "../../../../adapter/outbound/backend/prompt.adapter";
import { resolveBehaviorPrompt } from "../prompt_resolver";

vi.mock("../../../../shared/utils/jwt", () => ({
  signServiceJwt: vi.fn(() => "fake-token"),
}));

vi.mock("../../../../config/env", () => ({
  ENV: { BACKEND_URL: "" },
}));

vi.mock("../../../../shared/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const SAMPLE_RESPONSE = {
  id: "p1",
  version: 2,
  system_prompt: "You are a resolver agent.",
  bound_tools: ["web_search"],
  variables: ["mission"],
  status: "active",
};

const EXPECTED_PROMPT = {
  templateName: "main",
  version: 2,
  systemPrompt: "You are a resolver agent.",
  boundTools: ["web_search"],
  variables: ["mission"],
};

function stubRedis(overrides: Partial<Pick<Redis, "get" | "set">> = {}): Redis {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    ...overrides,
  } as unknown as Redis;
}

describe("resolveBehaviorPrompt", () => {
  const baseUrl = "http://test-backend:8080";
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test.each([undefined, null, ""])(
    "returns null when templateName is %p without calling fetch",
    async (templateName) => {
      const result = await resolveBehaviorPrompt({ templateName });

      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  test("returns the parsed BehaviorPrompt on a 200 response", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(SAMPLE_RESPONSE), { status: 200 }));
    const adapter = new PromptAdapter({ baseUrl, redis: stubRedis() });

    const result = await resolveBehaviorPrompt({ templateName: "main", tenantId: "tenant-1", adapter });

    expect(result).toEqual(EXPECTED_PROMPT);
  });

  test("defaults tenantId to local", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(SAMPLE_RESPONSE), { status: 200 }));
    const adapter = new PromptAdapter({ baseUrl, redis: stubRedis() });

    await resolveBehaviorPrompt({ templateName: "main", adapter });

    expect(fetchMock.mock.calls[0][1].headers["X-Tenant-ID"]).toBe("local");
  });

  test("returns null when the backend responds with 404", async () => {
    fetchMock.mockResolvedValue(new Response("not found", { status: 404 }));
    const adapter = new PromptAdapter({ baseUrl, redis: stubRedis() });

    await expect(resolveBehaviorPrompt({ templateName: "main", adapter })).resolves.toBeNull();
  });

  test("returns null when the backend responds with 500", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    const adapter = new PromptAdapter({ baseUrl, redis: stubRedis() });

    await expect(resolveBehaviorPrompt({ templateName: "main", adapter })).resolves.toBeNull();
  });

  test("returns null when the network request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const adapter = new PromptAdapter({ baseUrl, redis: stubRedis() });

    await expect(resolveBehaviorPrompt({ templateName: "main", adapter })).resolves.toBeNull();
  });

  test("reuses the cache so a second call does not hit the network", async () => {
    const redis = stubRedis({
      get: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(JSON.stringify(EXPECTED_PROMPT)),
    });
    const adapter = new PromptAdapter({ baseUrl, redis });
    fetchMock.mockResolvedValue(new Response(JSON.stringify(SAMPLE_RESPONSE), { status: 200 }));

    const first = await resolveBehaviorPrompt({ templateName: "main", tenantId: "tenant-1", adapter });
    const second = await resolveBehaviorPrompt({ templateName: "main", tenantId: "tenant-1", adapter });

    expect(first).toEqual(EXPECTED_PROMPT);
    expect(second).toEqual(EXPECTED_PROMPT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
