import { Context } from 'hono';
import { ProviderFactory } from '../../../infrastructure/providers/factory';
import { mapHistoryToMessages } from '../../../shared/utils/messages';
import { logger } from '../../../shared/utils/logger';

export async function handleSummarize(c: Context) {
  try {
    const body = await c.req.json();
    const { session_id, messages, max_summary_tokens, provider_config } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: "Missing or invalid 'messages' array" }, 400);
    }
    if (!provider_config) {
      return c.json({ error: "Missing 'provider_config'" }, 400);
    }

    logger.info(`[SUMMARIZE] Generating summary for session: ${session_id}`);

    // Reconstruct messages using the updated mapper
    const langchainMessages = mapHistoryToMessages(messages);

    // Create provider
    const provider = ProviderFactory.fromConfig(provider_config);

    const systemPrompt = `You are a professional software architect and session consolidator.
Summarize the following chat history into a single, concise paragraph. Focus on the main objective, key decisions, configuration details, and parameters agreed upon.
Do NOT include any pleasantries, conversational filler, or formatting other than plain text. Keep the output under ${max_summary_tokens || 500} tokens.`;

    const stream = provider.stream(langchainMessages, [], systemPrompt);
    let summary = "";
    let compTokens = 0;

    for await (const chunk of stream) {
      if (chunk.content) {
        summary += chunk.content;
      }
      if (chunk.usage?.completionTokens) {
        compTokens = chunk.usage.completionTokens;
      }
    }

    if (compTokens === 0) {
      compTokens = Math.ceil(summary.length / 4);
    }

    logger.info(`[SUMMARIZE] Session summary complete: ${summary.length} characters, ~${compTokens} tokens.`);

    return c.json({
      summary: summary.trim(),
      token_count: compTokens,
      messages_summarized: messages.length
    });
  } catch (err: any) {
    logger.error(`[SUMMARIZE] Summarization failed: ${err.message}`, err);
    return c.json({ error: "Summarization failed", details: err.message }, 500);
  }
}
