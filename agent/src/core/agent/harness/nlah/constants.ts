export const HARNESS_CONFIG = {
  DEFAULT_TENANT_ID: 'local',
  SUBAGENT_TENANT_ID: 'subagent',
  MAX_ITERATIONS: 15,
  PACING_THRESHOLD: 5,
  COMPACTION_RATIO: 0.9,
  DEFAULT_MAX_CONTEXT_TOKENS: 128_000,
  COST_THRESHOLD: 1.00,
  SIMILARITY_THRESHOLD: 0.92,
  KEEP_LAST_TURNS: 2,
  DROP_TOOL_IF_LONGER: 2000,
  CIRCUIT_BREAKER: {
    OPEN_AFTER: 3,
    MAX_RETRIES_PER_TOOL: 3,
    COMPRESS_OBSERVATIONS: true,
  },
  DEGRADATION: {
    DEGRADE_AFTER: 3,
    ABORT_AFTER: 7,
  },
  AGENT_STATUS: {
    STALL_TIMEOUT: 10000,
    HEARTBEAT_INTERVAL: 5000,
  },
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
  TOOL_SKIP: 'tool_skip',
  DEGRADED: 'degraded',
  STATE_CHANGE: 'state_change',
  PROGRESS: 'progress',
  HEARTBEAT: 'heartbeat',
  TURN_COMPLETE: 'turn_complete',
} as const;

