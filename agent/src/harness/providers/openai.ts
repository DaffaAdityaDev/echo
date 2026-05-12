import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, AIMessageChunk } from "@langchain/core/messages";
import { LLMProvider, ToolDefinition, ProviderEvent } from "../types";
import { LLM_CONFIG } from "../../shared/constants";

export class OpenAIProvider implements LLMProvider {
    private chat: ChatOpenAI;

    constructor(baseURL: string, modelName: string, apiKey: string = "dummy") {
        this.chat = new ChatOpenAI({
            configuration: { baseURL },
            modelName,
            apiKey,
            temperature: LLM_CONFIG.DEFAULT_TEMPERATURE,
            streaming: true,
        });
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
            if (usage) yield { usage: { promptTokens: usage.input_tokens ?? 0, completionTokens: usage.output_tokens ?? 0, totalTokens: usage.total_tokens ?? 0 } };
        }
    }
}
