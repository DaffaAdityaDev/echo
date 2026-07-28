import { ReasoningInterceptor } from "../reasoning-interceptor";

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("ReasoningInterceptor", () => {
  let origFetch: typeof globalThis.fetch;

  beforeAll(() => {
    origFetch = globalThis.fetch;
  });

  afterAll(() => {
    globalThis.fetch = origFetch;
  });

  it("extracts reasoning_content from OpenAI-style SSE chunks", async () => {
    const interceptor = new ReasoningInterceptor();
    globalThis.fetch = async () =>
      sseResponse([
        'data: {"id":"msg_1","choices":[{"delta":{"reasoning_content":"deep thinking"}}]}\n\n',
        'data: {"id":"msg_1","choices":[{"delta":{"content":"Hello world"}}]}\n\n',
        "data: [DONE]\n\n",
      ]);

    await interceptor.interceptFetch("http://test/v1/chat/completions", {});

    const active = Reflect.get(interceptor, "activeStreamPromise") as Promise<void> | null;
    if (active) await active;

    const sent = new Map<string, string>();
    const result = interceptor.getDelta("msg_1", sent);
    expect(result.fullReasoning).toBe("deep thinking");
    expect(result.deltaReasoning).toBe("deep thinking");
    expect(sent.get("msg_1")).toBe("deep thinking");
  });

  it("handles chunks without any reasoning", async () => {
    const interceptor = new ReasoningInterceptor();
    globalThis.fetch = async () =>
      sseResponse(['data: {"id":"msg_2","choices":[{"delta":{"content":"only content"}}]}\n\n', "data: [DONE]\n\n"]);

    await interceptor.interceptFetch("http://test/v1/chat/completions", {});
    const active = Reflect.get(interceptor, "activeStreamPromise") as Promise<void> | null;
    if (active) await active;

    const sent = new Map<string, string>();
    const result = interceptor.getDelta("msg_2", sent);
    expect(result.fullReasoning).toBe("");
    expect(result.deltaReasoning).toBe("");
  });

  it("accumulates reasoning across multiple SSE chunks", async () => {
    const interceptor = new ReasoningInterceptor();
    globalThis.fetch = async () =>
      sseResponse([
        'data: {"id":"msg_3","choices":[{"delta":{"reasoning_content":"step one"}}]}\n\n',
        'data: {"id":"msg_3","choices":[{"delta":{"reasoning_content":" step two"}}]}\n\n',
        'data: {"id":"msg_3","choices":[{"delta":{"content":"final answer"}}]}\n\n',
        "data: [DONE]\n\n",
      ]);

    await interceptor.interceptFetch("http://test/v1/chat/completions", {});
    const active = Reflect.get(interceptor, "activeStreamPromise") as Promise<void> | null;
    if (active) await active;

    const sent = new Map<string, string>();
    const result = interceptor.getDelta("msg_3", sent);
    expect(result.fullReasoning).toBe("step one step two");
    expect(result.deltaReasoning).toBe("step one step two");
  });

  it("getDelta returns only new delta since last call", async () => {
    const interceptor = new ReasoningInterceptor();
    globalThis.fetch = async () =>
      sseResponse([
        'data: {"id":"msg_4","choices":[{"delta":{"reasoning_content":"abc def"}}]}\n\n',
        "data: [DONE]\n\n",
      ]);

    await interceptor.interceptFetch("http://test/v1/chat/completions", {});
    const active = Reflect.get(interceptor, "activeStreamPromise") as Promise<void> | null;
    if (active) await active;

    const sent = new Map<string, string>();
    const first = interceptor.getDelta("msg_4", sent);
    expect(first.deltaReasoning).toBe("abc def");

    const second = interceptor.getDelta("msg_4", sent);
    expect(second.deltaReasoning).toBe("");
    expect(second.fullReasoning).toBe("abc def");
  });

  it("extracts reasoning from Anthropic thinking_delta format", async () => {
    const interceptor = new ReasoningInterceptor();
    globalThis.fetch = async () =>
      sseResponse([
        'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"claude reasoning"}}\n\n',
        "data: [DONE]\n\n",
      ]);

    await interceptor.interceptFetch("http://test/v1/messages", {});
    const active = Reflect.get(interceptor, "activeStreamPromise") as Promise<void> | null;
    if (active) await active;

    const sent = new Map<string, string>();
    const result = interceptor.getDelta("msg_5", sent);
    expect(result.fullReasoning).toBe("");
  });

  it("getDelta with undefined messageId returns empty", () => {
    const interceptor = new ReasoningInterceptor();
    const sent = new Map<string, string>();
    const result = interceptor.getDelta(undefined, sent);
    expect(result.fullReasoning).toBe("");
    expect(result.deltaReasoning).toBe("");
  });

  it("getReasoningTokenCount counts words in stored reasoning", async () => {
    const interceptor = new ReasoningInterceptor();
    globalThis.fetch = async () =>
      sseResponse([
        'data: {"id":"msg_t","choices":[{"delta":{"reasoning_content":"one two three four"}}]}\n\n',
        "data: [DONE]\n\n",
      ]);

    await interceptor.interceptFetch("http://test/v1/chat/completions", {});
    const active = Reflect.get(interceptor, "activeStreamPromise") as Promise<void> | null;
    if (active) await active;

    expect(interceptor.getReasoningTokenCount("msg_t")).toBe(4);
    expect(interceptor.getReasoningTokenCount("nonexistent")).toBeUndefined();
    expect(interceptor.getReasoningTokenCount(undefined)).toBeUndefined();
  });

  it("interceptFetch passes through non-LLM URLs without processing", async () => {
    const interceptor = new ReasoningInterceptor();
    globalThis.fetch = async () => new Response("ok", { status: 200 });

    const resp = await interceptor.interceptFetch("http://test/health", {});
    expect(resp.status).toBe(200);
    const body = await resp.text();
    expect(body).toBe("ok");
  });

  it("interceptFetch returns response as-is on HTTP error", async () => {
    const interceptor = new ReasoningInterceptor();
    globalThis.fetch = async () => new Response("error body", { status: 400, statusText: "Bad Request" });

    const resp = await interceptor.interceptFetch("http://test/v1/chat/completions", {});
    expect(resp.status).toBe(400);
  });
});
