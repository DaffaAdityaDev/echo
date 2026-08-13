import { ChatAnthropic } from "@langchain/anthropic";
import { type AIMessageChunk, type BaseMessage, SystemMessage } from "@langchain/core/messages";
import { LLM_CONFIG } from "../../../shared/constants";
import type { LLMProvider, ProviderEvent, ToolDefinition } from "../../../shared/types";
import { getLangChainCallbacks } from "../../../shared/utils/langfuse";
import { ReasoningInterceptor } from "../utils";

export class AnthropicProvider implements LLMProvider {
  private chat: ChatAnthropic;
  private interceptor = new ReasoningInterceptor();
  private apiKey: string;
  public modelName: string;
  public baseURL: string;
  public maxContextTokens: number;

  constructor(baseURL: string, modelName: string, apiKey?: string) {
    this.apiKey = apiKey ?? "";
    this.modelName = modelName;
    this.baseURL = baseURL || "https://api.anthropic.com";
    this.chat = new ChatAnthropic({
      anthropicApiKey: apiKey,
      modelName,
      temperature: LLM_CONFIG.DEFAULT_TEMPERATURE,
      streaming: true,
      clientOptions: {
        ...(baseURL ? { baseURL } : {}),
        fetch: (url: string | URL | Request, options?: RequestInit) => this.interceptor.interceptFetch(url, options),
      },
    });
    this.maxContextTokens = 200000;
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
        systemParts.push(m.content as string);
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
    const chatWithTools = this.chat.bindTools(lcTools as unknown as Parameters<typeof this.chat.bindTools>[0]);
    const callbacks = await getLangChainCallbacks();
    const langchainStream = await chatWithTools.stream(fullMessages, {
      callbacks,
      ...(signal ? { signal } : {}),
    });

    const sentReasoningMap = new Map<string, string>();
    let accumulatedChunk: AIMessageChunk | null = null;

    for await (const chunk of langchainStream) {
      accumulatedChunk = accumulatedChunk ? accumulatedChunk.concat(chunk) : chunk;
      const messageId = chunk.id;
      const { deltaReasoning } = this.interceptor.getDelta(messageId, sentReasoningMap);
      const textContent = typeof chunk.content === "string" ? chunk.content : "";

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
        yield { toolCall: { name: tc.name, args: tc.args as Record<string, unknown> } };
      }
      const usage = accumulatedChunk.usage_metadata;
      if (usage) {
        const lastId = accumulatedChunk.id;
        const reasoningTokenCount = this.interceptor.getReasoningTokenCount(lastId);
        const cachedTokens =
          (usage as { input_token_details?: { cache_read?: number } }).input_token_details?.cache_read ?? 0;
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

    await this.interceptor.cleanup(sentReasoningMap.keys());
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
