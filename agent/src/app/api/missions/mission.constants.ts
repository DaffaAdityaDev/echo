export const MISSION_STRATEGIES = ['standard', 'agent'] as const;

export const DEFAULT_MISSION_VALUES = {
  STRATEGY: 'agent' as typeof MISSION_STRATEGIES[number],
  TENANT_ID: 'local-developer',
  USER_ID: 'local-dev-user',
  ORG_ID: 'local-org',
} as const;

export const STRATEGY_MAPPING = {
  standard: ['standard', 'chat'] as readonly string[],
  agent: ['agent', 'nlah', 'deep-research', 'react', 'sequential'] as readonly string[],
} as const;

export const VALIDATION_MESSAGES = {
  PROMPT_REQUIRED: "Either 'prompt' or 'message' field is required",
  VALIDATION_ERROR: "Validation Error",
} as const;

export const MISSION_ROUTES = {
  GENERATE_MISSION: "/generate-mission",
} as const;

export const MISSION_LOG_MESSAGES = {
  STREAM_WRITE_FAILED: "Failed to write packet to stream",
  EXECUTION_FAILURE: "Execution failure",
} as const;
