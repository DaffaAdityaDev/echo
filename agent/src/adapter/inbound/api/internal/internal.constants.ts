export const SUMMARIZE_LOG_PREFIX = "[SUMMARIZE]";

// Fallback caps when the model context window is unknown: truncate any
// message beyond the char limit and cap the total payload so it can never
// exceed the provider context window, no matter what the caller sends.
export const SUMMARIZE_MAX_MSG_CHARS = 100000;
export const SUMMARIZE_MAX_TOTAL_TOKENS = 50000;

// Fraction of the model context window used as the summarize payload budget
// when max_context_tokens is provided by the caller.
export const SUMMARIZE_PAYLOAD_RATIO = 0.6;

export const SUMMARIZE_ERROR_MESSAGES = {
  MISSING_MESSAGES: "Missing or invalid 'messages' array",
  MISSING_PROVIDER_CONFIG: "Missing 'provider_config'",
  INVALID_BODY: "Invalid request body",
  SUMMARIZATION_FAILED: "Summarization failed",
} as const;
