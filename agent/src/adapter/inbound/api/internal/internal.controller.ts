import type { Context } from "hono";
import { ProviderFactory } from "../../../../infrastructure/providers/factory";
import { HTTP_STATUS } from "../../../../shared/constants/http";
import { estimateCharTokens } from "../../../../shared/utils/harness";
import { logger } from "../../../../shared/utils/logger";
import { mapHistoryToMessages } from "../../../../shared/utils/messages";
import { SUMMARIZE_ERROR_MESSAGES, SUMMARIZE_LOG_PREFIX } from "./internal.constants";
import { SummarizeRequestSchema, type SummarizeResponse } from "./internal.schema";

export async function summarizeSession(c: Context) {
  try {
    const parseResult = SummarizeRequestSchema.safeParse(await c.req.json());
    if (!parseResult.success) {
      const failedPath = parseResult.error.issues[0]?.path[0];
      if (failedPath === "messages") {
        return c.json({ error: SUMMARIZE_ERROR_MESSAGES.MISSING_MESSAGES }, HTTP_STATUS.BAD_REQUEST);
      }
      if (failedPath === "provider_config") {
        return c.json({ error: SUMMARIZE_ERROR_MESSAGES.MISSING_PROVIDER_CONFIG }, HTTP_STATUS.BAD_REQUEST);
      }
      return c.json(
        { error: SUMMARIZE_ERROR_MESSAGES.INVALID_BODY, details: parseResult.error.format() },
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const { session_id, messages, max_summary_tokens, provider_config } = parseResult.data;

    logger.info(`${SUMMARIZE_LOG_PREFIX} Generating summary for session: ${session_id}`);

    const langchainMessages = mapHistoryToMessages(messages);

    const provider = ProviderFactory.fromConfig({
      ...provider_config,
      api_key: provider_config.api_key ?? undefined,
    });

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
      compTokens = estimateCharTokens(summary);
    }

    logger.info(
      `${SUMMARIZE_LOG_PREFIX} Session summary complete: ${summary.length} characters, ~${compTokens} tokens.`,
    );

    const response: SummarizeResponse = {
      summary: summary.trim(),
      token_count: compTokens,
      messages_summarized: messages.length,
    };
    return c.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`${SUMMARIZE_LOG_PREFIX} Summarization failed: ${message}`, err);
    return c.json(
      { error: SUMMARIZE_ERROR_MESSAGES.SUMMARIZATION_FAILED, details: message },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}
