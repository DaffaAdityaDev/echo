export const HARNESS_CONFIG = {
  DEFAULT_TENANT_ID: 'local',
  SUBAGENT_TENANT_ID: 'subagent',
  MAX_ITERATIONS: 15,
  PACING_THRESHOLD: 5,
  COMPACTION_RATIO: 0.8,
  DEFAULT_MAX_CONTEXT_TOKENS: 128_000,
  COST_THRESHOLD: 1.00,
  SIMILARITY_THRESHOLD: 0.92,
  KEEP_LAST_TURNS: 2,
  DROP_TOOL_IF_LONGER: 2000,
} as const;

export const DEBUG_CONFIG = {
  ENV: 'development',
  DIR: 'debug',
  ENCODING: 'utf-8',
} as const;

export const OPERATION_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export const PACKET_TYPES = {
  METADATA: 'metadata',
  REASONING: 'reasoning',
  DEBUG: 'debug',
  CONTENT: 'content',
  USAGE: 'usage',
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  TODO: 'todo',
  SUBAGENT_CALL: 'subagent_call',
  SUBAGENT_RESULT: 'subagent_result',
} as const;
