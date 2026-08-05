export const SUMMARIZE_LOG_PREFIX = "[SUMMARIZE]";

export const SUMMARIZE_ERROR_MESSAGES = {
  MISSING_MESSAGES: "Missing or invalid 'messages' array",
  MISSING_PROVIDER_CONFIG: "Missing 'provider_config'",
  INVALID_BODY: "Invalid request body",
  SUMMARIZATION_FAILED: "Summarization failed",
} as const;
