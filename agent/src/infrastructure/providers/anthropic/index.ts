import type { Callbacks } from "@langchain/core/callbacks/manager";
import { ChatAnthropic } from "@langchain/anthropic";
import { type AIMessageChunk, type BaseMessage, SystemMessage } from "@langchain/core/messages";
import { LLM_CONFIG } from "../../../shared/constants";
import type { JsonObject, LLMProvider, ProviderEvent, ToolDefinition } from "../../../shared/types";
import { getLangChainCallbacks } from "../../../shared/utils/langfuse";
import { ANTHROPIC_MAX_CONTEXT_TOKENS } from "../constants";
import { ReasoningInterceptor } from "../utils";

function isString<T>(val: T): val is T & string {
  return typeof val === "string";
}

interface AnthropicClientOptions {
  baseURL?: string;
  fetch: (url: string | URL | Request, options?: RequestInit) => Promise<Response>;
}

interface AnthropicStreamOptions {
  callbacks: Callbacks;
  signal?: AbortSignal;
}

interface AnthropicUsageWithCache {
  input_token_details?: {
    cache_read?: number;
  };
}

export class AnthropicProvider implements LLMProvider {
  private chat: ChatAnthropic;
  private interceptor = new ReasoningInterceptor();
  private apiKey: string;
  public modelName: string;
  public baseURL: string;
  public maxContextTokens: number;

  constructor(baseURL: string, modelName: string, apiKey?: string, maxContextTokens?: number) {
    this.apiKey = apiKey ?? "";
    this.modelName = modelName;
    this.baseURL = baseURL || "https://api.anthropic.com";

    const clientOptions: AnthropicClientOptions = {
      fetch: (url: string | URL | Request, options?: RequestInit) => this.interceptor.interceptFetch(url, options),
    };

    if (baseURL) {
      clientOptions.baseURL = baseURL;
    }

    this.chat = new ChatAnthropic({
      anthropicApiKey: apiKey,
      modelName,
      temperature: LLM_CONFIG.DEFAULT_TEMPERATURE,
      streaming: true,
      clientOptions,
    });
    this.maxContextTokens = maxContextTokens ?? ANTHROPIC_MAX_CONTEXT_TOKENS;
  }

  async *stream(
    messages: BaseMessage[],
    tools: ToolDefinition[],
    systemPrompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<ProviderEvent> {
    if (!this.apiKey) {
      throw new Error(
        `AnthropicProvider: an API key is required but was not provided (baseURL=${this.baseURL}). Pass api_key in the provider config.`,
      );
    }

    const systemParts = [systemPrompt];

    const nonSystemMessages = messages.filter((m: BaseMessage) => {
      if (m._getType() === "system") {
        if (isString(m.content)) {
          systemParts.push(m.content);
        }

        return false;
      }

      return true;
    });

    // System prompt as content blocks with cache_control for max prefix cache hit
    const systemContent = [
      {
        type: "text" as const,
        text: systemParts.join("\n\n"),
        cache_control: { type: "ephemeral" as const },
      },
    ];

    const fullMessages = [new SystemMessage({ content: systemContent }), ...nonSystemMessages];

    // All tools are cacheable (they never change mid-mission)
    const lcTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      schema: t.schema,
      cache_control: { type: "ephemeral" as const },
    }));

    // SAFETY: lcTools matches ChatAnthropic bindTools input parameter contract with prompt caching metadata
    const chatWithTools = this.chat.bindTools(lcTools as Parameters<ChatAnthropic["bindTools"]>[0]);
    const callbacks = await getLangChainCallbacks();

    const streamOptions: AnthropicStreamOptions = { callbacks };

    if (signal) {
      streamOptions.signal = signal;
    }

    const langchainStream = await chatWithTools.stream(fullMessages, streamOptions);

    const sentReasoningMap = new Map<string, string>();

    try {
      let accumulatedChunk: AIMessageChunk | null = null;

      for await (const chunk of langchainStream) {
        accumulatedChunk = accumulatedChunk ? accumulatedChunk.concat(chunk) : chunk;
        const messageId = chunk.id;
        const { deltaReasoning } = this.interceptor.getDelta(messageId, sentReasoningMap);
        const textContent = isString(chunk.content) ? chunk.content : "";

        if (textContent || deltaReasoning) {
          yield {
            content: textContent || undefined,
            reasoning: deltaReasoning || undefined,
            id: messageId,
          };
        }
      }

      if (accumulatedChunk) {
        const toolCalls = accumulatedChunk.tool_calls;

        if (toolCalls && toolCalls.length > 0) {
          const tc = toolCalls[0];
          // SAFETY: tool call args parsed from model output are valid JSON objects
          yield { toolCall: { name: tc.name, args: tc.args as JsonObject } };
        }

        const usage = accumulatedChunk.usage_metadata;

        if (usage) {
          const lastId = accumulatedChunk.id;
          const reasoningTokenCount = this.interceptor.getReasoningTokenCount(lastId);

          // SAFETY: LangChain ChatAnthropic usage metadata provides input_token_details cache_read count
          const usageDetails = usage as AnthropicUsageWithCache;
          const cachedTokens = usageDetails.input_token_details?.cache_read ?? 0;

          yield {
            usage: {
              promptTokens: usage.input_tokens ?? 0,
              completionTokens: usage.output_tokens ?? 0,
              totalTokens: usage.total_tokens ?? 0,
              cachedTokens,
              reasoningTokens: reasoningTokenCount,
            },
          };
        }
      }
    } finally {
      await this.interceptor.cleanup(sentReasoningMap.keys());
    }
  }

  async cleanupReasoning(): Promise<void> {
    await this.interceptor.clearAll();
  }

  async validate(): Promise<void> {
    const response = await fetch(`${this.baseURL}/v1/models`, {
      headers: {
        "x-api-key": this.chat.anthropicApiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic validation failed (${response.status}): ${body}`);
    }
  }
}
