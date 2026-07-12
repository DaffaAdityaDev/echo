import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, AIMessageChunk } from "@langchain/core/messages";
import { LLMProvider, ToolDefinition, ProviderEvent } from "../../../shared/types";
import { LLM_CONFIG } from "../../../shared/constants";
import { getLangChainCallbacks } from "../../../utils/langfuse";
import { ReasoningInterceptor } from "../utils";

export class AnthropicProvider implements LLMProvider {
    private chat: ChatAnthropic;
    private interceptor = new ReasoningInterceptor();
    public modelName: string;
    public baseURL: string;
    public maxContextTokens: number;

    constructor(baseURL: string, modelName: string, apiKey: string = "dummy") {
        this.modelName = modelName;
        this.baseURL = baseURL || "https://api.anthropic.com";
        this.chat = new ChatAnthropic({
            anthropicApiKey: apiKey,
            modelName,
            temperature: LLM_CONFIG.DEFAULT_TEMPERATURE,
            streaming: true,
            clientOptions: {
                ...(baseURL ? { baseURL } : {}),
                fetch: (url: any, options: any) => this.interceptor.interceptFetch(url, options)
            },
        });
        this.maxContextTokens = 200000;
    }

    async *stream(messages: any[], tools: ToolDefinition[], systemPrompt: string): AsyncIterable<ProviderEvent> {
        const systemParts = [systemPrompt];
        const nonSystemMessages = messages.filter((m: any) => {
            if (m._getType() === 'system') {
                systemParts.push(m.content as string);
                return false;
            }
            return true;
        });
        // System prompt as content blocks with cache_control for max prefix cache hit
        const systemContent = [{
            type: "text" as const,
            text: systemParts.join('\n\n'),
            cache_control: { type: "ephemeral" as const }
        }];
        const fullMessages = [new SystemMessage({ content: systemContent }), ...nonSystemMessages];

        // All tools are cacheable (they never change mid-mission)
        const lcTools = tools.map((t) => ({
            name: t.name,
            description: t.description,
            schema: t.schema,
            cache_control: { type: "ephemeral" as const }
        }));
        const chatWithTools = this.chat.bindTools(lcTools as any);
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
}
