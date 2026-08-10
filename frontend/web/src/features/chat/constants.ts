export const CHAT_QUERY_KEYS = {
  sessions: ["sessions"],
  messages: (sessionId: string) => ["sessions", sessionId, "messages"],
} as const;

export const CHAT_ROLES = {
  USER: "user",
  ASSISTANT: "assistant",
} as const;

export const CHAT_MODES = {
  STANDARD: "standard",
  AGENT: "agent",
} as const;

export const PACKET_TYPES = {
  METADATA: "metadata",
  DEBUG: "debug",
  USAGE: "usage",
  CONTENT: "content",
  REASONING: "reasoning",
  TOOL_CALL: "tool_call",
  TOOL_RESULT: "tool_result",
  TODO: "todo",
  SUBAGENT_CALL: "subagent_call",
  SUBAGENT_RESULT: "subagent_result",
  FILE_OPERATION: "file_operation",
  SWARM_STATUS: "swarm_status",
  TOOL_SKIP: "tool_skip",
  HEARTBEAT: "heartbeat",
  STATE_CHANGE: "state_change",
  DEGRADED: "degraded",
  PROGRESS: "progress",
  TURN_COMPLETE: "turn_complete",
  ERROR: "error",
  SYSTEM_NOTICE: "system_notice",
  TOKEN_METRICS: "token_metrics",
  HITL_APPROVAL_REQUIRED: "hitl_approval_required",
  MISSION_COMPLETED: "mission_completed",
} as const;

export const CHAT_ENDPOINTS = {
  STREAM: "/chat/stream",
} as const;

// Keep in sync with the agent's CANCELLED_MESSAGE
// (agent/src/adapter/inbound/api/missions/mission.constants.ts): the error
// packet a cancelled mission records. Matched in the stream handlers to
// surface disconnect-cancelled turns as interrupted instead of completed
// errors.
export const CANCELLED_MESSAGE = "Mission cancelled by client disconnect";

export const SESSION_ENDPOINTS = {
  LIST: "/sessions",
  CREATE: "/sessions",
  GET: (id: string) => `/sessions/${id}`,
  UPDATE: (id: string) => `/sessions/${id}`,
  MESSAGES: (id: string) => `/sessions/${id}/messages`,
  DELETE: (id: string) => `/sessions/${id}`,
} as const;
