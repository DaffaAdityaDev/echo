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
} as const;

export const CHAT_MESSAGES = {
  ERROR: "Chat error:",
  ORCHESTRATING: "Orchestrating response...",
} as const;

export const CHAT_ENDPOINTS = {
  STREAM: "/chat",
  HISTORY: "/chat/history",
} as const;
