export const ERROR_TYPES = {
  APPLICATION_ERROR: "APPLICATION_ERROR",
  RATE_LIMIT: "RATE_LIMIT_ERROR",
  TIMEOUT: "TIMEOUT_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL_SERVER: "INTERNAL_SERVER_ERROR",
} as const;

export const ERROR_MESSAGES = {
  RATE_LIMIT: "Upstream LLM Provider API rate limit exceeded. Please retry shortly.",
  TIMEOUT: "Upstream LLM Provider query timed out. Please retry.",
  BAD_REQUEST: "Malformed request payload body. Ensure valid JSON structure is supplied.",
  INTERNAL_SERVER: "Internal server error",
} as const;
