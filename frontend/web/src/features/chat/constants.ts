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
} as const;

export const CHAT_ENDPOINTS = {
  STREAM: "/chat/stream",
} as const;

export const SESSION_ENDPOINTS = {
  LIST: "/sessions",
  CREATE: "/sessions",
  GET: (id: string) => `/sessions/${id}`,
  MESSAGES: (id: string) => `/sessions/${id}/messages`,
  DELETE: (id: string) => `/sessions/${id}`,
} as const;
