export const STORAGE_CONSTANTS = {
  BACKEND_MEMORY: "memory",
  DEFAULT_TTL_SECONDS: 3600,
  PAUSED_SLOT_PREFIX: "paused:",
  SLOT_SEPARATOR: "::",
} as const;

export const STORAGE_LOG_MESSAGES = {
  MEMORY_ACTIVE: "🧠 Agent State Channel: PURE RAM INSTANCE ACTIVE",
} as const;
