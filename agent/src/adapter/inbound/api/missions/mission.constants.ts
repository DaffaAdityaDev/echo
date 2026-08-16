import { CANCELLED_MESSAGE } from "../../../../shared/constants/errors";

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

export const VALIDATION_MESSAGES = {
  PROMPT_REQUIRED: "Either 'prompt' or 'message' field is required",
  VALIDATION_ERROR: "Validation Error",
} as const;

export const MISSION_ROUTES = {
  GENERATE_MISSION: "/generate-mission",
  APPROVE: "/sessions/:id/approve",
  DENY: "/sessions/:id/deny",
  CANCEL: "/sessions/:id/cancel",
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
  CANCELLED_MESSAGE: CANCELLED_MESSAGE,
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
  MISSION_CANCELLED: "MISSION_CANCELLED",
  INVALID_DECISION: "Invalid decision payload",
  PROVIDER_CONFIG_REQUIRED:
    "PROVIDER_CONFIG_REQUIRED: resume needs provider_config in the request body (API keys are not persisted)",
} as const;
