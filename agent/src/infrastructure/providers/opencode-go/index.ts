import OpenAI from "openai";
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { zodV4ToOpenAISchema, calculateUsageCost } from "../utils";
import { LLMProvider, ToolDefinition, ProviderEvent } from "../../../shared/types";
import { ReasoningInterceptor } from "../utils";
import { langfuseStorage } from "../../../utils/langfuse";

function contentToString(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content
            .filter((b: any) => b?.type === "text")
            .map((b: any) => b.text ?? "")
            .join("\n");
    }
    return "";
}

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
            fetch: (url: any, options: any) => this.interceptor.interceptFetch(url, options)
        });
    }

    private serializeMessages(messages: any[], systemPrompt: string): any[] {
        const result: any[] = [{ role: "system", content: systemPrompt }];
        for (const msg of messages) {
            if (msg instanceof SystemMessage || msg._getType?.() === "system") {
                result.push({ role: "system", content: contentToString(msg.content) });
            } else if (msg instanceof HumanMessage || msg._getType?.() === "human") {
                result.push({ role: "user", content: contentToString(msg.content) });
            } else if (msg instanceof AIMessage || msg._getType?.() === "ai") {
                const entry: any = { role: "assistant", content: contentToString(msg.content) };
                if (msg.tool_calls && msg.tool_calls.length > 0) {
                    entry.tool_calls = msg.tool_calls.map((tc: any) => ({
                        id: tc.id || `call_${Date.now()}`,
                        type: "function",
                        function: {
                            name: tc.name,
                            arguments: typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args)
                        }
                    }));
                }
                if (msg.additional_kwargs?.reasoning_content) {
                    entry.reasoning_content = msg.additional_kwargs.reasoning_content;
                }
                result.push(entry);
            } else if (msg instanceof ToolMessage || msg._getType?.() === "tool") {
                result.push({
                    role: "tool",
                    tool_call_id: msg.tool_call_id,
                    content: typeof msg.content === "string" ? msg.content : (contentToString(msg.content) || JSON.stringify(msg.content))
                });
            }
        }
        return result;
    }

    async *stream(messages: any[], tools: ToolDefinition[], systemPrompt: string): AsyncIterable<ProviderEvent> {
        const apiMessages = this.serializeMessages(messages, systemPrompt);
        const apiTools = tools.length > 0 ? tools.map(t => ({
            type: "function" as const,
            function: {
                name: t.name,
                description: t.description,
                parameters: zodV4ToOpenAISchema(t.schema)
            }
        })) : undefined;

        const storeContext = langfuseStorage.getStore();
        const trace = storeContext?.trace;
        const generation = trace?.generation ? trace.generation({
            name: `opencode-go-${this.modelName}`,
            model: this.modelName,
            input: apiMessages,
            metadata: { baseURL: this.baseURL }
        }) : null;

        const sentReasoningMap = new Map<string, string>();
        const accumulatedToolCalls = new Map<number, { name: string; argsStr: string }>();
        let finalUsageEvent: ProviderEvent | null = null;
        let isEnded = false;

        try {
            let responseStream;
            try {
                responseStream = await this.client.chat.completions.create({
                    model: this.modelName,
                    messages: apiMessages,
                    tools: apiTools as any,
                    stream: true,
                    stream_options: { include_usage: true }
                });
            } catch (err: any) {
                const errMsg = (err?.message || "").toLowerCase();
                if (errMsg.includes("multimodal") || errMsg.includes("image")) {
                    if (generation) {
                        generation.end({
                            output: `Model '${this.modelName}' does not support multimodal content.`,
                            level: "ERROR"
                        });
                        isEnded = true;
                    }
                    yield {
                        content: `[Error: Model '${this.modelName}' does not support multimodal content.]`
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
                            id: messageId
                        };
                    }

                    if (delta.tool_calls && delta.tool_calls.length > 0) {
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
                    const cachedTokens = (chunk.usage as any).prompt_tokens_details?.cached_tokens ?? 0;
                    const promptTokens = chunk.usage.prompt_tokens ?? 0;
                    const completionTokens = chunk.usage.completion_tokens ?? 0;
                    const totalTokens = chunk.usage.total_tokens ?? 0;

                    const { stepCost } = calculateUsageCost(this.modelName, this.baseURL, promptTokens, completionTokens, cachedTokens);

                    if (generation) {
                        generation.end({
                            output: Array.from(accumulatedToolCalls.values()),
                            usage: {
                                promptTokens,
                                completionTokens,
                                totalTokens,
                            },
                            costDetails: { totalCost: stepCost }
                        });
                        isEnded = true;
                    }

                    finalUsageEvent = {
                        usage: {
                            promptTokens,
                            completionTokens,
                            totalTokens,
                            cachedTokens,
                            reasoningTokens: reasoningTokenCount
                        }
                    };
                }
            }

            // Emit all accumulated tool calls (supports parallel tool calling)
            for (const [_, tc] of accumulatedToolCalls) {
                if (tc.name) {
                    let parsedArgs: Record<string, unknown> = {};
                    try {
                        parsedArgs = JSON.parse(tc.argsStr);
                    } catch (e) {
                        parsedArgs = { raw: tc.argsStr };
                    }
                    yield {
                        toolCall: {
                            name: tc.name,
                            args: parsedArgs
                        }
                    };
                }
            }

            if (finalUsageEvent) {
                yield finalUsageEvent;
            }
        } catch (err: any) {
            if (generation && !isEnded) {
                generation.end({
                    output: err?.message || "Stream error",
                    level: "ERROR"
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
