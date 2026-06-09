import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, AIMessageChunk } from "@langchain/core/messages";
import { LLMProvider, ToolDefinition, ProviderEvent } from "../../shared/types";
import { LLM_CONFIG } from "../../shared/constants";

export class OpenAIProvider implements LLMProvider {
    private chat: ChatOpenAI;
    public modelName: string;
    public baseURL: string;
    public maxContextTokens: number;

    constructor(baseURL: string, modelName: string, apiKey: string = "dummy") {
        this.modelName = modelName;
        this.baseURL = baseURL;
        this.chat = new ChatOpenAI({
            configuration: { baseURL },
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

        // Check if running on localhost / LM Studio
        if (lowerURL.includes("localhost") || lowerURL.includes("127.0.0.1") || lowerURL.includes("lm-studio")) {
            if (lowerModel.includes("32k")) return 32768;
            if (lowerModel.includes("16k")) return 16384;
            if (lowerModel.includes("8k")) return 8192;
            if (lowerModel.includes("4k")) return 4096;
            return 8192; // Safe fallback for small local models
        }

        // OpenAI Cloud models
        if (lowerModel.includes("gpt-4o-mini")) return 128000;
        if (lowerModel.includes("gpt-4o")) return 128000;
        if (lowerModel.includes("gpt-4")) return 8192;
        if (lowerModel.includes("gpt-3.5")) return 16384;

        return 4096; // Absolute fallback
    }

    async *stream(messages: any[], tools: ToolDefinition[], systemPrompt: string): AsyncIterable<ProviderEvent> {
        const fullMessages = [new SystemMessage(systemPrompt), ...messages];
        const lcTools = tools.map(t => ({ name: t.name, description: t.description, schema: t.schema }));
        const chatWithTools = this.chat.bindTools(lcTools);
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
