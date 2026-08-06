import type { Context } from "hono";
import { countTokens } from "../../../../core/tokens/tokenizer";
import { HTTP_STATUS } from "../../../../shared/constants/http";
import { logger } from "../../../../shared/utils/logger";
import { TokenizeRequestSchema } from "./internal.schema";

export async function tokenize(c: Context) {
  const parseResult = TokenizeRequestSchema.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json(
      { error: "Invalid tokenize request", details: parseResult.error.format() },
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  try {
    const tokens = countTokens(parseResult.data.text);
    return c.json({ tokens });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[TOKENIZE] Failed to count tokens: ${message}`);
    return c.json({ error: "Tokenization failed" }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
