export const STORAGE_CONSTANTS = {
  BACKEND_REDIS: "redis",
  BACKEND_MEMORY: "memory",
  REDIS_KEY_PREFIX: "agent:state:",
  REDIS_EX_MODE: "EX",
  DEFAULT_TTL_SECONDS: 3600,
} as const;

export const STORAGE_LOG_MESSAGES = {
  REDIS_ACTIVE: "🔋 Agent State Channel: REDIS BACKEND ACTIVE",
  MEMORY_ACTIVE: "🧠 Agent State Channel: PURE RAM INSTANCE ACTIVE",
  REDIS_ERROR: "Redis Client Error",
} as const;
