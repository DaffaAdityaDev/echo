export const HARNESS_CONFIG = {
  DEFAULT_TENANT_ID: 'local',
  SUBAGENT_TENANT_ID: 'subagent',
  MAX_ITERATIONS: 15,
  PACING_THRESHOLD: 8,
  COMPACTION_RATIO: 0.8,
  DEFAULT_MAX_CONTEXT_TOKENS: 8192,
  COST_THRESHOLD: 1.00,
  SIMILARITY_THRESHOLD: 0.92,
} as const;

export const FILE_OPS = {
  WRITE: 'write',
  READ: 'read',
  OFFLOAD: 'offload',
  FILE_ENCODING: 'utf-8' as const,
  DEBUG_DIR: 'debug',
  DEVELOPMENT_ENV: 'development',
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
  FILE_OPERATION: 'file_operation',
} as const;
