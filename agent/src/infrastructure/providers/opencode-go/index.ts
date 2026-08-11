import { AIMessage, type BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import OpenAI from "openai";
import type { LLMProvider, ProviderEvent, ToolDefinition } from "../../../shared/types";
import { langfuseStorage } from "../../../shared/utils/langfuse";
import { logger } from "../../../shared/utils/logger";
import { calculateUsageCost, ReasoningInterceptor, zodV4ToOpenAISchema } from "../utils";

function contentToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: { type?: string }) => b?.type === "text")
      .map((b: { text?: string }) => b.text ?? "")
      .join("\n");
  }
  return "";
}

type ApiToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

type ApiAssistantMessage = {
  role: "assistant";
  content: string;
  tool_calls?: ApiToolCall[];
  reasoning_content?: unknown;
};

type ApiMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | ApiAssistantMessage
  | { role: "tool"; content: string; tool_call_id: string };

export class OpenCodeGoProvider implements LLMProvider {
  private client: OpenAI;
  private interceptor = new ReasoningInterceptor();
  public modelName: string;
  public baseURL: string;
  public maxContextTokens: number = 1_000_000;

  constructor(baseURL: string, modelName: string, apiKey: string = "dummy") {
    this.modelName = modelName;
    this.baseURL = baseURL;
    this.client = new OpenAI({
      baseURL,
      apiKey,
      fetch: (url, options) => this.interceptor.interceptFetch(url, options),
    });
  }

  private serializeMessages(messages: BaseMessage[], systemPrompt: string): ApiMessage[] {
    const result: ApiMessage[] = [{ role: "system", content: systemPrompt }];
    for (const msg of messages) {
      if (msg instanceof SystemMessage || msg._getType?.() === "system") {
        result.push({ role: "system", content: contentToString(msg.content) });
      } else if (msg instanceof HumanMessage || msg._getType?.() === "human") {
        result.push({ role: "user", content: contentToString(msg.content) });
      } else if (msg instanceof AIMessage || msg._getType?.() === "ai") {
        const entry: ApiAssistantMessage = { role: "assistant", content: contentToString(msg.content) };
        const aiMessage = msg as AIMessage;
        if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
          entry.tool_calls = aiMessage.tool_calls.map((tc) => ({
            id: tc.id || `call_${Date.now()}`,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args),
            },
          }));
        }
        if (msg.additional_kwargs?.reasoning_content) {
          entry.reasoning_content = msg.additional_kwargs.reasoning_content;
        }
        result.push(entry);
      } else if (msg instanceof ToolMessage || msg._getType?.() === "tool") {
        result.push({
          role: "tool",
          tool_call_id: (msg as ToolMessage).tool_call_id,
          content:
            typeof msg.content === "string" ? msg.content : contentToString(msg.content) || JSON.stringify(msg.content),
        });
      }
    }
    return result;
  }

  async *stream(
    messages: BaseMessage[],
    tools: ToolDefinition[],
    systemPrompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<ProviderEvent> {
    const apiMessages = this.serializeMessages(messages, systemPrompt);
    const apiTools =
      tools.length > 0
        ? tools.map((t) => ({
            type: "function" as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: zodV4ToOpenAISchema(t.schema),
            },
          }))
        : undefined;

    logger.info(
      `[OpenCodeGoProvider.stream] model=${this.modelName} targetModel=${this.modelName.replace(/^opencode-go\//i, "")} toolsProvided=${tools.length} hasApiTools=${!!apiTools}`,
    );
    if (tools.length > 0) {
      logger.info(`[OpenCodeGoProvider.stream] Tool names: ${tools.map((t) => t.name).join(", ")}`);
      try {
        const schemaSample = JSON.stringify(apiTools?.[0].function.parameters).substring(0, 300);
        logger.info(`[OpenCodeGoProvider.stream] First tool schema (truncated): ${schemaSample}`);
      } catch {}
    } else {
      logger.info(`[OpenCodeGoProvider.stream] No tools provided — sending request without tools parameter`);
    }

    const storeContext = langfuseStorage.getStore();
    const trace = storeContext?.trace;
    const generation = trace?.generation
      ? trace.generation({
          name: `opencode-go-${this.modelName}`,
          model: this.modelName,
          input: apiMessages,
          metadata: { baseURL: this.baseURL },
        })
      : null;

    const sentReasoningMap = new Map<string, string>();
    const accumulatedToolCalls = new Map<number, { name: string; argsStr: string }>();
    let finalUsageEvent: ProviderEvent | null = null;
    let isEnded = false;

    const targetModel = this.modelName.replace(/^opencode-go\//i, "");

    try {
      let responseStream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
      try {
        logger.info(
          `[OpenCodeGoProvider.stream] Calling API: model=${targetModel} messages=${apiMessages.length} tools=${apiTools?.length ?? 0}`,
        );
        responseStream = await this.client.chat.completions.create(
          {
            model: targetModel,
            messages: apiMessages,
            tools: apiTools,
            stream: true,
            stream_options: { include_usage: true },
          },
          signal ? { signal } : undefined,
        );
      } catch (err: unknown) {
        const e =
          err instanceof Error
            ? (err as Error & { status?: number; code?: string; type?: string })
            : (err as { message?: string; status?: number; code?: string; type?: string });
        logger.error(
          `❌ [OpenCodeGoProvider] Stream request failed for model '${this.modelName}' at '${this.baseURL}': ${e?.message}`,
          {
            status: e?.status,
            code: e?.code,
            type: e?.type,
            error: err,
          },
        );
        const errMsg = (e?.message || "").toLowerCase();
        if (errMsg.includes("multimodal") || errMsg.includes("image")) {
          if (generation) {
            generation.end({
              output: `Model '${this.modelName}' does not support multimodal content.`,
              level: "ERROR",
            });
            isEnded = true;
          }
          yield {
            content: `[Error: Model '${this.modelName}' does not support multimodal content.]`,
          };
          return;
        }
        throw err;
      }

      for await (const chunk of responseStream) {
        const messageId = chunk.id;
        const choice = chunk.choices?.[0];
        const delta = choice?.delta;

        if (delta) {
          const { deltaReasoning } = this.interceptor.getDelta(messageId, sentReasoningMap);
          const textContent = delta.content || "";

          if (textContent || deltaReasoning) {
            yield {
              content: textContent || undefined,
              reasoning: deltaReasoning || undefined,
              id: messageId,
            };
          }

          if (delta.tool_calls && delta.tool_calls.length > 0) {
            logger.info(
              `[OpenCodeGoProvider.stream] Received tool_calls delta: ${JSON.stringify(delta.tool_calls.map((tc) => ({ index: tc.index, name: tc.function?.name, argsLen: tc.function?.arguments?.length })))}`,
            );
            for (const tcDelta of delta.tool_calls) {
              const index = tcDelta.index ?? 0;
              const existing = accumulatedToolCalls.get(index) || { name: "", argsStr: "" };
              if (tcDelta.function?.name) existing.name += tcDelta.function.name;
              if (tcDelta.function?.arguments) existing.argsStr += tcDelta.function.arguments;
              accumulatedToolCalls.set(index, existing);
            }
          }
        }

        if (chunk.usage) {
          const reasoningTokenCount = this.interceptor.getReasoningTokenCount(messageId);
          const cachedTokens =
            (chunk.usage as unknown as { prompt_tokens_details?: { cached_tokens?: number } }).prompt_tokens_details
              ?.cached_tokens ?? 0;
          const promptTokens = chunk.usage.prompt_tokens ?? 0;
          const completionTokens = chunk.usage.completion_tokens ?? 0;
          const totalTokens = chunk.usage.total_tokens ?? 0;

          const { stepCost } = calculateUsageCost(
            this.modelName,
            this.baseURL,
            promptTokens,
            completionTokens,
            cachedTokens,
          );

          if (generation) {
            generation.end({
              output: Array.from(accumulatedToolCalls.values()),
              usage: {
                promptTokens,
                completionTokens,
                totalTokens,
              },
              costDetails: { totalCost: stepCost },
            });
            isEnded = true;
          }

          finalUsageEvent = {
            usage: {
              promptTokens,
              completionTokens,
              totalTokens,
              cachedTokens,
              reasoningTokens: reasoningTokenCount,
            },
          };
        }
      }

      // Emit all accumulated tool calls (supports parallel tool calling)
      logger.info(`[OpenCodeGoProvider.stream] Emitting ${accumulatedToolCalls.size} accumulated tool calls`);
      for (const [_, tc] of accumulatedToolCalls) {
        if (tc.name) {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(tc.argsStr);
          } catch (e) {
            logger.warn(`[OpenCodeGoProvider.stream] Failed to parse tool args JSON: ${e}`);
            parsedArgs = { raw: tc.argsStr };
          }
          logger.info(`[OpenCodeGoProvider.stream] Yielding toolCall: ${tc.name} args=${JSON.stringify(parsedArgs)}`);
          yield {
            toolCall: {
              name: tc.name,
              args: parsedArgs,
            },
          };
        } else {
          logger.warn(`[OpenCodeGoProvider.stream] Accumulated tool call has no name, skipping: ${JSON.stringify(tc)}`);
        }
      }

      if (finalUsageEvent) {
        yield finalUsageEvent;
      }
    } catch (err: unknown) {
      const streamError = err as { message?: string };
      if (generation && !isEnded) {
        generation.end({
          output: streamError.message || "Stream error",
          level: "ERROR",
        });
        isEnded = true;
      }
      throw err;
    } finally {
      if (generation && !isEnded) {
        generation.end({ output: Array.from(accumulatedToolCalls.values()) });
      }
      await this.interceptor.cleanup(sentReasoningMap.keys());
    }
  }

  async cleanupReasoning(): Promise<void> {
    await this.interceptor.clearAll();
  }

  async validate(): Promise<void> {
    await this.client.models.list();
  }
}
