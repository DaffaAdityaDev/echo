import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, AIMessageChunk } from "@langchain/core/messages";
import { LLMProvider, ToolDefinition, ProviderEvent } from "../../../shared/types";
import { LLM_CONFIG } from "../../../shared/constants";
import { getLangChainCallbacks } from "../../../utils/langfuse";
import { ReasoningInterceptor } from "../utils";

/**
 * LM Studio Provider.
 * 
 * Strategy: Stream for display (content + reasoning), then use the accumulated
 * final message to extract tool calls. This avoids partial-chunk parsing errors.
 */
export class LMStudioProvider implements LLMProvider {
    private chat: ChatOpenAI;
    private interceptor = new ReasoningInterceptor();
    public modelName: string;
    public baseURL: string;
    public maxContextTokens: number;

    constructor(baseURL: string, modelName: string, apiKey: string = "lm-studio") {
        this.modelName = modelName;
        this.baseURL = baseURL;
        this.chat = new ChatOpenAI({
            configuration: {
                baseURL,
                fetch: (url, options) => this.interceptor.interceptFetch(url, options)
            },
            modelName,
            apiKey,
            temperature: LLM_CONFIG.DEFAULT_TEMPERATURE,
            streaming: true,
        });
        this.maxContextTokens = this.resolveContextWindow(modelName);
    }

    private resolveContextWindow(model: string): number {
        const lowerModel = model.toLowerCase();
        if (lowerModel.includes("32k")) return 32768;
        if (lowerModel.includes("16k")) return 16384;
        if (lowerModel.includes("8k")) return 8192;
        if (lowerModel.includes("4k")) return 4096;
        return 8192; // Safe default for local models
    }

    /**
     * Single entry point: stream a response from the model.
     * 
     * Phase 1 — Streaming: Yields content/reasoning events for real-time display.
     * Phase 2 — After stream: Yields a single toolCall event if the model called a tool.
     *
     * Tool calls are extracted from the fully-accumulated message AFTER the stream ends,
     * ensuring args are always complete and never fragmented.
     */
    async *stream(messages: any[], tools: ToolDefinition[], systemPrompt: string): AsyncIterable<ProviderEvent> {
        const fullMessages = [new SystemMessage(systemPrompt), ...messages];

        const lcTools = tools.map(t => ({
            name: t.name,
            description: t.description,
            schema: t.schema
        }));

        const chatWithTools = this.chat.bindTools(lcTools);
        const callbacks = await getLangChainCallbacks();
        const langchainStream = await chatWithTools.stream(fullMessages, { callbacks });

        const sentReasoningMap = new Map<string, string>();
        let accumulatedChunk: AIMessageChunk | null = null;

        // Phase 1: Stream content and reasoning to the client
        for await (const chunk of langchainStream) {
            // Accumulate all chunks so we can inspect the final message for tool calls
            accumulatedChunk = accumulatedChunk ? accumulatedChunk.concat(chunk) : chunk;

            const messageId = chunk.id;
            const { deltaReasoning } = this.interceptor.getDelta(messageId, sentReasoningMap);

            const textContent = typeof chunk.content === 'string' ? chunk.content : "";

            if (textContent || deltaReasoning) {
                yield {
                    content: textContent || undefined,
                    reasoning: deltaReasoning || undefined,
                    id: messageId
                };
            }
        }

        // Phase 2: Extract tool calls from the fully-accumulated final message
        if (accumulatedChunk) {
            const toolCalls = accumulatedChunk.tool_calls;
            if (toolCalls && toolCalls.length > 0) {
                const tc = toolCalls[0];
                yield {
                    toolCall: {
                        name: tc.name,
                        args: tc.args as Record<string, unknown>
                    }
                };
            }

            // Emit token usage from the final chunk
            const usage = accumulatedChunk.usage_metadata;
            if (usage) {
                const lastId = accumulatedChunk.id;
                const reasoningTokenCount = this.interceptor.getReasoningTokenCount(lastId);

                yield {
                    usage: {
                        promptTokens: usage.input_tokens ?? 0,
                        completionTokens: usage.output_tokens ?? 0,
                        totalTokens: usage.total_tokens ?? 0,
                        reasoningTokens: reasoningTokenCount
                    }
                };
            }
        }

        // Cleanup reasoning store
        await this.interceptor.cleanup(sentReasoningMap.keys());
    }

    async cleanupReasoning(): Promise<void> {
        await this.interceptor.clearAll();
    }

    async validate(): Promise<void> {
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ baseURL: this.baseURL, apiKey: this.chat.apiKey });
        await client.models.list();
    }
}
