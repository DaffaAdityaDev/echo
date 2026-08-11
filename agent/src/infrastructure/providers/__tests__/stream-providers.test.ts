import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, AIMessageChunk, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import type { LLMProvider, ProviderEvent, ToolDefinition } from "../../../shared/types";
import { AnthropicProvider } from "../anthropic";
import { LMStudioProvider } from "../lm-studio";
import { OpenAIProvider } from "../openai";
import { OpenCodeGoProvider } from "../opencode-go";

interface MockChatConfig {
  apiKey?: string;
  anthropicApiKey?: string;
}

interface MockChatInstance {
  config?: MockChatConfig;
  apiKey?: string;
  anthropicApiKey?: string;
  bindTools: (tools: unknown) => unknown;
  stream: (messages: unknown, options: unknown) => unknown;
}

const openAIMocks = vi.hoisted(() => {
  const create = vi.fn();
  const list = vi.fn();
  return {
    create,
    list,
    OpenAI: class {
      chat = { completions: { create } };
      models = { list };
    },
  };
});

const langchainOpenAIMocks = vi.hoisted(() => {
  const stream = vi.fn();
  const bindTools = vi.fn();
  return {
    stream,
    bindTools,
    ChatOpenAI: vi.fn().mockImplementation(function (this: MockChatInstance, config: MockChatConfig) {
      this.config = config;
      this.apiKey = config?.apiKey;
      this.bindTools = bindTools;
      this.stream = stream;
    }),
  };
});

const langchainAnthropicMocks = vi.hoisted(() => {
  const stream = vi.fn();
  const bindTools = vi.fn();
  return {
    stream,
    bindTools,
    ChatAnthropic: vi.fn().mockImplementation(function (this: MockChatInstance, config: MockChatConfig) {
      this.config = config;
      this.anthropicApiKey = config?.anthropicApiKey;
      this.bindTools = bindTools;
      this.stream = stream;
    }),
  };
});

const langfuseMocks = vi.hoisted(() => ({
  getStore: vi.fn(() => undefined),
  getLangChainCallbacks: vi.fn(async () => []),
  startAgentTrace: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("openai", () => ({ default: openAIMocks.OpenAI }));
vi.mock("@langchain/openai", () => ({ ChatOpenAI: langchainOpenAIMocks.ChatOpenAI }));
vi.mock("@langchain/anthropic", () => ({ ChatAnthropic: langchainAnthropicMocks.ChatAnthropic }));
vi.mock("../../../shared/utils/langfuse", () => ({
  langfuseStorage: { getStore: langfuseMocks.getStore },
  getLangChainCallbacks: langfuseMocks.getLangChainCallbacks,
  startAgentTrace: langfuseMocks.startAgentTrace,
}));
vi.mock("../../../shared/utils/logger", () => loggerMocks);

async function* sdkChunks(chunks: unknown[]): AsyncGenerator<unknown> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

function makeTool(name: string, description: string, schema: z.ZodTypeAny): ToolDefinition {
  return { name, description, schema } as unknown as ToolDefinition;
}

async function collect(
  provider: LLMProvider,
  messages: BaseMessage[] = [],
  tools: ToolDefinition[] = [],
  systemPrompt = "You are a test assistant.",
): Promise<ProviderEvent[]> {
  const events: ProviderEvent[] = [];
  for await (const event of provider.stream(messages, tools, systemPrompt)) {
    events.push(event);
  }
  return events;
}

describe("OpenCodeGoProvider", () => {
  beforeEach(() => {
    openAIMocks.create.mockReset();
    openAIMocks.list.mockReset();
  });

  function makeProvider(): OpenCodeGoProvider {
    return new OpenCodeGoProvider("http://opencode-go.test", "opencode-go/gpt-4o");
  }

  it("yields content events, an accumulated tool call, and usage", async () => {
    openAIMocks.create.mockReturnValue(
      sdkChunks([
        { id: "m1", choices: [{ delta: { content: "Hel" } }] },
        { id: "m1", choices: [{ delta: { content: "lo" } }] },
        {
          id: "m1",
          choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "web_search", arguments: '{"q":' } }] } }],
        },
        {
          id: "m1",
          choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"weather"}' } }] } }],
        },
        { id: "m1", choices: [{ delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
      ]),
    );

    const events = await collect(makeProvider(), [], [], "You are a test assistant.");

    expect(events).toEqual([
      { content: "Hel", id: "m1" },
      { content: "lo", id: "m1" },
      { toolCall: { name: "web_search", args: { q: "weather" } } },
      { usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cachedTokens: 0 } },
    ]);
    expect(openAIMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        messages: [{ role: "system", content: "You are a test assistant." }],
        stream: true,
        stream_options: { include_usage: true },
      }),
      undefined,
    );
  });

  it("yields an error content event and terminates for multimodal errors", async () => {
    openAIMocks.create.mockRejectedValue(new Error("Model does not support multimodal content."));

    const events = await collect(makeProvider(), [], [], "You are a test assistant.");

    expect(events).toEqual([{ content: "[Error: Model 'opencode-go/gpt-4o' does not support multimodal content.]" }]);
  });

  it("rejects with the SDK error for other failures", async () => {
    openAIMocks.create.mockRejectedValue(new Error("boom"));

    await expect(collect(makeProvider(), [], [], "You are a test assistant.")).rejects.toThrow("boom");
  });

  it("serializes LangChain messages into OpenAI API messages", async () => {
    openAIMocks.create.mockReturnValue(sdkChunks([]));
    const messages = [
      new SystemMessage("system detail"),
      new HumanMessage("hi there"),
      new AIMessage({
        content: "let me search",
        tool_calls: [{ id: "call_1", name: "web_search", args: { q: "weather" } }],
      }),
      new ToolMessage({ content: "sunny", tool_call_id: "call_1" }),
    ];

    await collect(makeProvider(), messages, [], "You are a test assistant.");

    expect(openAIMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a test assistant." },
          { role: "system", content: "system detail" },
          { role: "user", content: "hi there" },
          {
            role: "assistant",
            content: "let me search",
            tool_calls: [
              { id: "call_1", type: "function", function: { name: "web_search", arguments: '{"q":"weather"}' } },
            ],
          },
          { role: "tool", tool_call_id: "call_1", content: "sunny" },
        ],
      }),
      undefined,
    );
  });

  it("maps tools into OpenAI function schemas", async () => {
    openAIMocks.create.mockReturnValue(sdkChunks([]));
    const tools = [makeTool("web_search", "Search the web", z.object({ q: z.string() }))];

    await collect(makeProvider(), [], tools, "You are a test assistant.");

    expect(openAIMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          {
            type: "function",
            function: {
              name: "web_search",
              description: "Search the web",
              parameters: expect.objectContaining({ type: "object" }),
            },
          },
        ],
      }),
      undefined,
    );
  });
});

describe("OpenAIProvider", () => {
  beforeEach(() => {
    langchainOpenAIMocks.stream.mockReset();
    langchainOpenAIMocks.bindTools.mockReset();
    langchainOpenAIMocks.bindTools.mockReturnValue({ stream: langchainOpenAIMocks.stream });
  });

  function makeProvider(): OpenAIProvider {
    return new OpenAIProvider("http://openai.test", "gpt-4o-mini");
  }

  it("yields content events and passes tools to bindTools", async () => {
    const tools = [makeTool("web_search", "Search the web", z.object({ q: z.string() }))];
    langchainOpenAIMocks.stream.mockResolvedValue([
      new AIMessageChunk({ id: "m1", content: "Hel" }),
      new AIMessageChunk({ id: "m1", content: "lo" }),
    ]);

    const events = await collect(makeProvider(), [], tools, "You are a test assistant.");

    expect(events).toEqual([
      { content: "Hel", id: "m1" },
      { content: "lo", id: "m1" },
    ]);
    expect(langchainOpenAIMocks.bindTools).toHaveBeenCalledWith([
      { name: "web_search", description: "Search the web", schema: expect.any(Object) },
    ]);
    expect(langchainOpenAIMocks.stream).toHaveBeenCalledWith([expect.any(SystemMessage)], { callbacks: [] });
  });

  it("yields tool calls and usage from the accumulated chunk", async () => {
    langchainOpenAIMocks.stream.mockResolvedValue([
      new AIMessageChunk({
        id: "m1",
        content: "done",
        tool_calls: [{ id: "call_1", name: "web_search", args: { q: "weather" } }],
        usage_metadata: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
          input_token_details: { cache_read: 7 },
        },
      }),
    ]);

    const events = await collect(makeProvider(), [], [], "You are a test assistant.");

    expect(events).toEqual([
      { content: "done", id: "m1" },
      { toolCall: { name: "web_search", args: { q: "weather" } } },
      { usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cachedTokens: 7 } },
    ]);
  });

  it("rejects when the SDK stream throws", async () => {
    langchainOpenAIMocks.stream.mockRejectedValue(new Error("boom"));

    await expect(collect(makeProvider(), [], [], "You are a test assistant.")).rejects.toThrow("boom");
  });
});

describe("AnthropicProvider", () => {
  beforeEach(() => {
    langchainAnthropicMocks.stream.mockReset();
    langchainAnthropicMocks.bindTools.mockReset();
    langchainAnthropicMocks.bindTools.mockReturnValue({ stream: langchainAnthropicMocks.stream });
  });

  function makeProvider(): AnthropicProvider {
    return new AnthropicProvider("https://anthropic.test", "claude-sonnet-4");
  }

  it("yields content events and merges system messages into cacheable blocks", async () => {
    langchainAnthropicMocks.stream.mockResolvedValue([
      new AIMessageChunk({ id: "m1", content: "Hel" }),
      new AIMessageChunk({ id: "m1", content: "lo" }),
    ]);

    const events = await collect(makeProvider(), [new SystemMessage("extra system")], [], "You are a test assistant.");

    expect(events).toEqual([
      { content: "Hel", id: "m1" },
      { content: "lo", id: "m1" },
    ]);
    const firstArg = langchainAnthropicMocks.stream.mock.calls[0][0] as unknown[];
    const systemMsg = firstArg[0] as SystemMessage;
    expect(systemMsg.content).toEqual([
      { type: "text", text: "You are a test assistant.\n\nextra system", cache_control: { type: "ephemeral" } },
    ]);
  });

  it("yields tool calls and usage and marks tools cacheable", async () => {
    const tools = [makeTool("web_search", "Search the web", z.object({ q: z.string() }))];
    langchainAnthropicMocks.stream.mockResolvedValue([
      new AIMessageChunk({
        id: "m1",
        content: "done",
        tool_calls: [{ id: "call_1", name: "web_search", args: { q: "weather" } }],
        usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      }),
    ]);

    const events = await collect(makeProvider(), [], tools, "You are a test assistant.");

    expect(events).toEqual([
      { content: "done", id: "m1" },
      { toolCall: { name: "web_search", args: { q: "weather" } } },
      { usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cachedTokens: 0 } },
    ]);
    expect(langchainAnthropicMocks.bindTools).toHaveBeenCalledWith([
      {
        name: "web_search",
        description: "Search the web",
        schema: expect.any(Object),
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  it("rejects when the SDK stream throws", async () => {
    langchainAnthropicMocks.stream.mockRejectedValue(new Error("boom"));

    await expect(collect(makeProvider(), [], [], "You are a test assistant.")).rejects.toThrow("boom");
  });
});

describe("LMStudioProvider", () => {
  beforeEach(() => {
    langchainOpenAIMocks.stream.mockReset();
    langchainOpenAIMocks.bindTools.mockReset();
    langchainOpenAIMocks.bindTools.mockReturnValue({ stream: langchainOpenAIMocks.stream });
  });

  function makeProvider(): LMStudioProvider {
    return new LMStudioProvider("http://localhost:1234", "local-model-8k");
  }

  it("normalizes the base URL with /v1", () => {
    expect(makeProvider().baseURL).toBe("http://localhost:1234/v1");
  });

  it("yields content events", async () => {
    langchainOpenAIMocks.stream.mockResolvedValue([
      new AIMessageChunk({ id: "m1", content: "Hel" }),
      new AIMessageChunk({ id: "m1", content: "lo" }),
    ]);

    const events = await collect(makeProvider(), [], [], "You are a test assistant.");

    expect(events).toEqual([
      { content: "Hel", id: "m1" },
      { content: "lo", id: "m1" },
    ]);
  });

  it("yields tool calls and usage without cachedTokens", async () => {
    langchainOpenAIMocks.stream.mockResolvedValue([
      new AIMessageChunk({
        id: "m1",
        content: "done",
        tool_calls: [{ id: "call_1", name: "web_search", args: { q: "weather" } }],
        usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      }),
    ]);

    const events = await collect(makeProvider(), [], [], "You are a test assistant.");

    expect(events).toEqual([
      { content: "done", id: "m1" },
      { toolCall: { name: "web_search", args: { q: "weather" } } },
      { usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
    ]);
  });

  it("rejects when the SDK stream throws", async () => {
    langchainOpenAIMocks.stream.mockRejectedValue(new Error("boom"));

    await expect(collect(makeProvider(), [], [], "You are a test assistant.")).rejects.toThrow("boom");
  });
});
