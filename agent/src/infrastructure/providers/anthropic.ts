import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, AIMessageChunk } from "@langchain/core/messages";
import { LLMProvider, ToolDefinition, ProviderEvent } from "../../shared/types";
import { LLM_CONFIG } from "../../shared/constants";

export class AnthropicProvider implements LLMProvider {
    private chat: ChatAnthropic;
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
            clientOptions: baseURL ? { baseURL } : undefined,
        });
        this.maxContextTokens = 200000;
    }

    async *stream(messages: any[], tools: ToolDefinition[], systemPrompt: string): AsyncIterable<ProviderEvent> {
        const fullMessages = [new SystemMessage(systemPrompt), ...messages];
        const lcTools = tools.map((t, idx) => ({
            name: t.name,
            description: t.description,
            schema: t.schema,
            // Trik NLAH: Tandai tool terakhir agar skema tools dibekukan di dalam cache cluster
            ...(idx === tools.length - 1 && { cache_control: { type: "ephemeral" } })
        }));
        const chatWithTools = this.chat.bindTools(lcTools as any);
        const langchainStream = await chatWithTools.stream(fullMessages);

        let accumulatedChunk: AIMessageChunk | null = null;

        for await (const chunk of langchainStream) {
            accumulatedChunk = accumulatedChunk ? accumulatedChunk.concat(chunk) : chunk;
            const textContent = typeof chunk.content === 'string' ? chunk.content : "";
            if (textContent) yield { content: textContent, id: chunk.id };
        }

        if (accumulatedChunk) {
            const toolCalls = accumulatedChunk.tool_calls;
            if (toolCalls && toolCalls.length > 0) {
                const tc = toolCalls[0];
                yield { toolCall: { name: tc.name, args: tc.args as Record<string, unknown> } };
            }
            const usage = accumulatedChunk.usage_metadata;
            if (usage) {
                const cachedTokens = (usage as any).input_token_details?.cache_read ?? 0;
                yield {
                    usage: {
                        promptTokens: usage.input_tokens ?? 0,
                        completionTokens: usage.output_tokens ?? 0,
                        totalTokens: usage.total_tokens ?? 0,
                        cachedTokens
                    }
                };
            }
        }
    }
}
