import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, AIMessageChunk } from "@langchain/core/messages";
import { LLMProvider, ToolDefinition, ProviderEvent } from "../../../shared/types";
import { LLM_CONFIG } from "../../../shared/constants";
import { getLangChainCallbacks } from "../../../utils/langfuse";
import { ReasoningInterceptor } from "../utils";

export class OpenAIProvider implements LLMProvider {
    private chat: ChatOpenAI;
    private interceptor = new ReasoningInterceptor();
    public modelName: string;
    public baseURL: string;
    public maxContextTokens: number;

    constructor(baseURL: string, modelName: string, apiKey: string = "dummy") {
        this.modelName = modelName;
        this.baseURL = baseURL;
        this.chat = new ChatOpenAI({
            configuration: {
                baseURL,
                fetch: (url: any, options: any) => this.interceptor.interceptFetch(url, options)
            },
            modelName,
            apiKey,
            temperature: LLM_CONFIG.DEFAULT_TEMPERATURE,
            streaming: true,
        });
        this.maxContextTokens = this.resolveContextWindow(modelName, baseURL);
    }

    private resolveContextWindow(model: string, url: string): number {
        const lowerModel = model.toLowerCase();
        const lowerURL = url.toLowerCase();

        if (lowerURL.includes("localhost") || lowerURL.includes("127.0.0.1") || lowerURL.includes("lm-studio")) {
            if (lowerModel.includes("128k")) return 128000;
            if (lowerModel.includes("32k")) return 32768;
            if (lowerModel.includes("16k")) return 16384;
            if (lowerModel.includes("8k")) return 8192;
            if (lowerModel.includes("4k")) return 4096;
            return 8192;
        }

        const modelMap: [string, number][] = [
            ["gpt-4o-mini", 128000],
            ["gpt-4o", 128000],
            ["gpt-4", 8192],
            ["gpt-3.5", 16384],
            ["deepseek-", 1_000_000],
            ["minimax-m3", 1_000_000],
            ["minimax-m2.5", 192_000],
            ["minimax-", 256_000],
            ["kimi-", 256_000],
            ["glm-5.2", 1_000_000],
            ["glm-5", 198_000],
            ["glm-", 198_000],
            ["qwen", 1_000_000],
            ["mimo-v2.5-pro", 1_000_000],
            ["mimo-", 128_000],
            ["hy3-", 128_000],
        ];

        for (const [pattern, tokens] of modelMap) {
            if (lowerModel.includes(pattern)) return tokens;
        }

        return 128_000;
    }

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
        for await (const chunk of langchainStream) {
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

                const cachedTokens = (usage as any).input_token_details?.cache_read ?? 0;
                yield {
                    usage: {
                        promptTokens: usage.input_tokens ?? 0,
                        completionTokens: usage.output_tokens ?? 0,
                        totalTokens: usage.total_tokens ?? 0,
                        cachedTokens,
                        reasoningTokens: reasoningTokenCount
                    }
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
