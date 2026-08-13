import { type AIMessageChunk, type BaseMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { LLM_CONFIG } from "../../../shared/constants";
import type { LLMProvider, ProviderEvent, ToolDefinition } from "../../../shared/types";
import { getLangChainCallbacks } from "../../../shared/utils/langfuse";
import { ReasoningInterceptor } from "../utils";

export class OpenAIProvider implements LLMProvider {
  private chat: ChatOpenAI;
  private interceptor = new ReasoningInterceptor();
  private apiKey: string;
  public modelName: string;
  public baseURL: string;
  public maxContextTokens?: number;

  constructor(baseURL: string, modelName: string, apiKey?: string, maxContextTokens?: number) {
    this.apiKey = apiKey ?? "";
    this.modelName = modelName;
    this.baseURL = baseURL;
    this.maxContextTokens = maxContextTokens;
    this.chat = new ChatOpenAI({
      configuration: {
        baseURL,
        fetch: (url: string | URL | Request, options?: RequestInit) => this.interceptor.interceptFetch(url, options),
      },
      modelName,
      apiKey,
      temperature: LLM_CONFIG.DEFAULT_TEMPERATURE,
      streaming: true,
    });
  }

  async *stream(
    messages: BaseMessage[],
    tools: ToolDefinition[],
    systemPrompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<ProviderEvent> {
    if (!this.apiKey) {
      throw new Error(
        `OpenAIProvider: an API key is required but was not provided (baseURL=${this.baseURL}). Pass api_key in the provider config.`,
      );
    }
    const fullMessages = [new SystemMessage(systemPrompt), ...messages];

    const lcTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      schema: t.schema,
    }));

    const chatWithTools = this.chat.bindTools(lcTools);
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
    // Create a minimal client to test connectivity + API key
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ baseURL: this.baseURL, apiKey: this.chat.apiKey });
    await client.models.list();
  }
}
