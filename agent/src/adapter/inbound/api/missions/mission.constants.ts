export const MISSION_STRATEGIES = ["standard", "agent"] as const;

export const DEFAULT_MISSION_VALUES = {
  STRATEGY: "agent" as (typeof MISSION_STRATEGIES)[number],
  TENANT_ID: "local-developer",
  USER_ID: "local-dev-user",
  ORG_ID: "local-org",
} as const;

export const STRATEGY_MAPPING = {
  standard: ["standard", "chat"] as readonly string[],
  agent: ["agent", "nlah", "deep-research", "react", "sequential"] as readonly string[],
} as const;

export const STRATEGY_VERSIONS = {
  STANDARD_V1: "standard:v1",
  NLAH_V1: "nlah:v1",
} as const;

export const STRATEGY_VERSION_ALIASES = {
  "standard:v1": ["chat"],
  "nlah:v1": ["agent", "nlah", "deep-research", "react", "sequential"],
} as const;

export const DEFAULT_STRATEGY_VERSION = STRATEGY_VERSIONS.NLAH_V1;

export const VALIDATION_MESSAGES = {
  PROMPT_REQUIRED: "Either 'prompt' or 'message' field is required",
  VALIDATION_ERROR: "Validation Error",
} as const;

export const MISSION_ROUTES = {
  GENERATE_MISSION: "/generate-mission",
  APPROVE: "/:id/approve",
  DENY: "/:id/deny",
} as const;

export const HITL_DECISIONS = {
  APPROVE: "approve",
  DENY: "deny",
} as const;

export const MISSION_LOG_MESSAGES = {
  STREAM_WRITE_FAILED: "Failed to write packet to stream",
  EXECUTION_FAILURE: "Execution failure",
} as const;

export const STREAM_CONSTANTS = {
  CANCELLED_MESSAGE: "Mission cancelled by client disconnect",
  ERROR_CODE: "STREAM_EXECUTION_ERROR",
  ERROR_STEP: 0,
} as const;

export const STREAM_LOG_MESSAGES = {
  EXECUTION_FAILED: "Stream execution failed:",
  RESUME_EXECUTION_FAILED: "Resume stream execution failed:",
  SEND_ERROR_FAILED: "Failed to send error packet to client:",
  SEND_RESUME_ERROR_FAILED: "Failed to send error packet:",
} as const;

export const MISSION_ERROR_MESSAGES = {
  UNKNOWN_FEATURE: (id: string) => `Unknown feature '${id}'`,
  PROVIDER_UNREACHABLE: "Provider unreachable",
  APPROVAL_EXPIRED_OR_NOT_FOUND: "APPROVAL_EXPIRED_OR_NOT_FOUND",
  INVALID_DECISION: "Invalid decision payload",
} as const;
