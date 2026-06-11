export const CHAT_ROLES = {
  USER: "user",
  ASSISTANT: "assistant",
} as const;

export const CHAT_MODES = {
  STANDARD: "standard",
  AGENT: "agent",
  NLAH: "nlah",
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
} as const;

export const CHAT_MESSAGES = {
  ERROR: "Chat error:",
  ORCHESTRATING: "Orchestrating response...",
} as const;

export const CHAT_ENDPOINTS = {
  STREAM: "/chat",
  HISTORY: "/chat/history",
} as const;
