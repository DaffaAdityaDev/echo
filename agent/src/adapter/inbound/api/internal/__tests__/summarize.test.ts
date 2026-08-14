import { Hono } from "hono";
import { ProviderFactory } from "../../../../../infrastructure/providers/factory";
import { summarizeSession } from "../internal.controller";

vi.mock("../../../../../infrastructure/providers/factory", () => ({
  ProviderFactory: { fromConfig: vi.fn() },
}));

vi.mock("../../../../../shared/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), langfuse: vi.fn() },
}));

function buildApp() {
  const app = new Hono();
  app.post("/sessions/summarize", summarizeSession);
  return app;
}

function summarizeRequest(body: unknown) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("Agent Summarization Endpoint", () => {
  test("returns 400 when missing messages", async () => {
    const app = buildApp();

    const res = await app.request(
      "/sessions/summarize",
      summarizeRequest({
        session_id: "test-session",
        provider_config: {
          type: "openai",
          base_url: "http://localhost",
          model: "gpt-4o",
        },
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toContain("messages");
  });

  test("returns 400 when missing provider_config", async () => {
    const app = buildApp();

    const res = await app.request(
      "/sessions/summarize",
      summarizeRequest({
        session_id: "test-session",
        messages: [{ role: "user", content: "hello" }],
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toContain("provider_config");
  });

  test("returns 400 when provider_config.type is unsupported", async () => {
    const app = buildApp();

    const res = await app.request(
      "/sessions/summarize",
      summarizeRequest({
        session_id: "test-session",
        messages: [{ role: "user", content: "hello" }],
        provider_config: {
          type: "groq",
          base_url: "http://localhost",
          model: "llama-3",
        },
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toContain("provider_config");
  });

  test("returns 400 when session_id is not a string", async () => {
    const app = buildApp();

    const res = await app.request(
      "/sessions/summarize",
      summarizeRequest({
        session_id: 42,
        messages: [{ role: "user", content: "hello" }],
        provider_config: {
          type: "openai",
          base_url: "http://localhost",
          model: "gpt-4o",
        },
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toBe("Invalid request body");
    expect(body.details).toBeDefined();
  });

  test("returns 200 with a summary when the provider streams", async () => {
    vi.mocked(ProviderFactory.fromConfig).mockReturnValue({
      stream: vi.fn(async function* () {
        yield { content: "Consolidated summary.", usage: { completionTokens: 5 } };
      }),
      validate: vi.fn(async () => {}),
      cleanupReasoning: vi.fn(async () => {}),
      maxContextTokens: 128000,
      modelName: "fake-model",
      baseURL: "http://fake.local",
    } as unknown as Awaited<ReturnType<typeof ProviderFactory.fromConfig>>);

    const app = buildApp();
    const res = await app.request(
      "/sessions/summarize",
      summarizeRequest({
        session_id: "test-session",
        messages: [
          { role: "user", content: "hello" },
          { role: "assistant", content: "hi" },
        ],
        provider_config: {
          type: "openai",
          base_url: "http://localhost",
          model: "gpt-4o",
        },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { summary: string; token_count: number; messages_summarized: number };
    expect(body.summary).toBe("Consolidated summary.");
    expect(body.token_count).toBe(5);
    expect(body.messages_summarized).toBe(2);
  });

  test("truncates and caps giant message payloads within the model context budget", async () => {
    const streamMock = vi.fn(async function* () {
      yield { content: "Summary.", usage: { completionTokens: 5 } };
    });
    vi.mocked(ProviderFactory.fromConfig).mockReturnValue({
      stream: streamMock,
      validate: vi.fn(async () => {}),
      cleanupReasoning: vi.fn(async () => {}),
      maxContextTokens: 128000,
      modelName: "fake-model",
      baseURL: "http://fake.local",
    } as unknown as Awaited<ReturnType<typeof ProviderFactory.fromConfig>>);

    const app = buildApp();
    const giant = "x".repeat(1_000_000);
    const res = await app.request(
      "/sessions/summarize",
      summarizeRequest({
        session_id: "test-session",
        messages: [
          { role: "user", content: giant },
          { role: "assistant", content: giant },
        ],
        provider_config: {
          type: "openai",
          base_url: "http://localhost",
          model: "gpt-4o",
          max_context_tokens: 128000,
        },
      }),
    );

    expect(res.status).toBe(200);
    const sent = streamMock.mock.calls[0][0] as unknown as { content: string }[];
    const budget = Math.floor(128000 * 0.6);
    const perMsgChars = Math.max(budget * 2, 100000);
    let totalTokens = 0;
    for (const m of sent) {
      expect(m.content.length).toBeLessThanOrEqual(perMsgChars + "\n...[truncated]".length);
      totalTokens += Math.ceil(m.content.length / 4);
    }
    expect(totalTokens).toBeLessThanOrEqual(budget);
  });

  test("keeps the full payload when the model context window is large", async () => {
    const streamMock = vi.fn(async function* () {
      yield { content: "Summary.", usage: { completionTokens: 5 } };
    });
    vi.mocked(ProviderFactory.fromConfig).mockReturnValue({
      stream: streamMock,
      validate: vi.fn(async () => {}),
      cleanupReasoning: vi.fn(async () => {}),
      maxContextTokens: 10_000_000,
      modelName: "fake-model",
      baseURL: "http://fake.local",
    } as unknown as Awaited<ReturnType<typeof ProviderFactory.fromConfig>>);

    const app = buildApp();
    const giant = "x".repeat(1_000_000);
    const res = await app.request(
      "/sessions/summarize",
      summarizeRequest({
        session_id: "test-session",
        messages: [
          { role: "user", content: giant },
          { role: "assistant", content: giant },
        ],
        provider_config: {
          type: "opencode-go",
          base_url: "http://localhost",
          model: "deepseek-v4-flash",
          max_context_tokens: 10_000_000,
        },
      }),
    );

    expect(res.status).toBe(200);
    const sent = streamMock.mock.calls[0][0] as unknown as { content: string }[];
    expect(sent.length).toBe(2);
    expect(sent[0].content).toBe(giant);
    expect(sent[1].content).toBe(giant);
  });

  test("falls back to fixed caps when the context window is unknown", async () => {
    const streamMock = vi.fn(async function* () {
      yield { content: "Summary.", usage: { completionTokens: 5 } };
    });
    vi.mocked(ProviderFactory.fromConfig).mockReturnValue({
      stream: streamMock,
      validate: vi.fn(async () => {}),
      cleanupReasoning: vi.fn(async () => {}),
      modelName: "fake-model",
      baseURL: "http://fake.local",
    } as unknown as Awaited<ReturnType<typeof ProviderFactory.fromConfig>>);

    const app = buildApp();
    const giant = "x".repeat(1_000_000);
    const res = await app.request(
      "/sessions/summarize",
      summarizeRequest({
        session_id: "test-session",
        messages: [
          { role: "user", content: giant },
          { role: "assistant", content: giant },
        ],
        provider_config: {
          type: "lm-studio",
          base_url: "http://localhost",
          model: "custom-model",
        },
      }),
    );

    expect(res.status).toBe(200);
    const sent = streamMock.mock.calls[0][0] as unknown as { content: string }[];
    expect(sent.length).toBeLessThan(2);
    for (const m of sent) {
      expect(m.content.length).toBeLessThanOrEqual(100000 + "\n...[truncated]".length);
    }
  });

  test("returns 500 when the provider stream fails", async () => {
    vi.mocked(ProviderFactory.fromConfig).mockReturnValue({
      stream: vi.fn(() => {
        throw new Error("upstream down");
      }),
    } as unknown as Awaited<ReturnType<typeof ProviderFactory.fromConfig>>);

    const app = buildApp();
    const res = await app.request(
      "/sessions/summarize",
      summarizeRequest({
        session_id: "test-session",
        messages: [{ role: "user", content: "hello" }],
        provider_config: {
          type: "openai",
          base_url: "http://localhost",
          model: "gpt-4o",
        },
      }),
    );

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toBe("Summarization failed");
    expect(body.details).toBe("upstream down");
  });
});
