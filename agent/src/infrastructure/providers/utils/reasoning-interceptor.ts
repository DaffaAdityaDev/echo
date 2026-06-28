/**
 * Shared Reasoning Interceptor Utility for LLM Providers.
 * Captures thinking / reasoning tokens from raw SSE streams across providers (OpenAI, LM Studio, Anthropic).
 */
export class ReasoningInterceptor {
    private store = new Map<string, string>();
    private activeStreamPromise: Promise<void> | null = null;

    /**
     * Fetch interceptor to tee readable stream and extract reasoning tokens asynchronously.
     */
    public async interceptFetch(url: any, options: any): Promise<Response> {
        const response = await fetch(url, options);

        if (response.ok && response.body) {
            const urlStr = url.toString();
            if (urlStr.includes('/chat/completions') || urlStr.includes('/messages')) {
                const [stream1, stream2] = response.body.tee();
                this.activeStreamPromise = this.processReasoningStream(stream1);
                return new Response(stream2, response);
            }
        }

        return response;
    }

    /**
     * Processes raw SSE chunks and extracts reasoning content.
     */
    private async processReasoningStream(stream: ReadableStream): Promise<void> {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let partial = "";
        let currentMessageId: string | null = null;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = (partial + chunk).split("\n");
                partial = lines.pop() || "";

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const dataStr = line.slice(6).trim();
                    if (dataStr === "[DONE]") continue;

                    try {
                        const json = JSON.parse(dataStr);
                        
                        // Extract Message / Event ID
                        const extractedId: string | null = json.id || json.message?.id || null;
                        if (extractedId) {
                            currentMessageId = extractedId;
                        }
                        const id = extractedId || currentMessageId;

                        let reasoning: string | undefined;

                        // 1. OpenAI / LM Studio / DeepSeek format
                        if (json.choices?.[0]?.delta) {
                            const delta = json.choices[0].delta;
                            reasoning = delta.reasoning_content || delta.reasoning;
                        } 
                        // 2. Anthropic extended thinking format
                        else if (json.type === "content_block_delta" && json.delta) {
                            if (json.delta.type === "thinking_delta" || json.delta.type === "thinking") {
                                reasoning = json.delta.thinking;
                            }
                        } else if (json.delta?.thinking) {
                            reasoning = json.delta.thinking;
                        }

                        if (id && reasoning) {
                            const current = this.store.get(id) || "";
                            this.store.set(id, current + reasoning);
                        }
                    } catch (e) {
                        // Ignore parse errors on incomplete JSON chunks
                    }
                }
            }
        } catch (e) {
            // Stream read closed or aborted
        }
    }

    /**
     * Retrieves the newly appended reasoning delta for a message ID.
     */
    public getDelta(messageId: string | undefined, sentReasoningMap: Map<string, string>): { deltaReasoning: string; fullReasoning: string } {
        if (!messageId) {
            return { deltaReasoning: "", fullReasoning: "" };
        }

        const fullReasoning = this.store.get(messageId) || "";
        const alreadySent = sentReasoningMap.get(messageId) || "";
        const deltaReasoning = fullReasoning.slice(alreadySent.length);

        if (deltaReasoning) {
            sentReasoningMap.set(messageId, fullReasoning);
        }

        return { deltaReasoning, fullReasoning };
    }

    /**
     * Calculates reasoning token count based on captured text.
     */
    public getReasoningTokenCount(messageId: string | undefined): number | undefined {
        if (!messageId) return undefined;
        const text = this.store.get(messageId);
        if (!text) return undefined;
        return text.trim().split(/\s+/).length;
    }

    /**
     * Cleans up stored reasoning for sent message IDs after awaiting active stream completion.
     */
    public async cleanup(sentIds: Iterable<string>): Promise<void> {
        if (this.activeStreamPromise) {
            try {
                await this.activeStreamPromise;
            } catch (e) {
                // Ignore stream abort errors
            }
        }
        for (const id of sentIds) {
            this.store.delete(id);
        }
    }

    /**
     * Completely purges all stored reasoning entries after awaiting active stream completion.
     */
    public async clearAll(): Promise<void> {
        if (this.activeStreamPromise) {
            try {
                await this.activeStreamPromise;
            } catch (e) {
                // Ignore stream abort errors
            }
        }
        this.store.clear();
    }
}
