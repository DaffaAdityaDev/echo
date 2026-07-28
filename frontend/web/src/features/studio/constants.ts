export const STUDIO_ENDPOINTS = {
  PROMPTS: "/studio/prompts",
  PROMPTS_ACTIVE: (name: string) => `/studio/prompts/active?name=${encodeURIComponent(name)}`,
  PROMPT_VERSIONS: (id: string) => `/studio/prompts/${id}/versions`,
  PROMPT_VERSION: (id: string, v: number) => `/studio/prompts/${id}/versions/${v}`,
  PROMPT_PROMOTE: (id: string, v: number) => `/studio/prompts/${id}/promote/${v}`,
  PROMPT_ROLLBACK: (id: string, v: number) => `/studio/prompts/${id}/rollback/${v}`,
  MATURITY: "/studio/maturity",
  MATURITY_CLIENT: "/studio/maturity/client",
  PLAYGROUND: "/studio/playground",
} as const;

export const STUDIO_QUERY_KEYS = {
  PROMPTS: ["studio", "prompts"] as const,
  PROMPT_VERSIONS: (id: string) => ["studio", "prompts", id, "versions"] as const,
  MATURITY: ["studio", "maturity"] as const,
} as const;

export const PACKET_TYPES = {
  METADATA: "metadata",
  REASONING: "reasoning",
  CONTENT: "content",
  TOOL_CALL: "tool_call",
  TOOL_RESULT: "tool_result",
  TOOL_SKIP: "tool_skip",
  TODO: "todo",
  USAGE: "usage",
  PROGRESS: "progress",
  HEARTBEAT: "heartbeat",
  STATE_CHANGE: "state_change",
  DEGRADED: "degraded",
  TURN_COMPLETE: "turn_complete",
  DEBUG: "debug",
  SUBAGENT_CALL: "subagent_call",
  SUBAGENT_RESULT: "subagent_result",
  ERROR: "error",
  SWARM_STATUS: "swarm_status",
  FILE_OPERATION: "file_operation",
} as const;

export const DEBUG_TABS = [
  { id: "output", label: "Output" },
  { id: "tree", label: "Tree" },
  { id: "timeline", label: "Timeline" },
  { id: "status", label: "Status" },
  { id: "tokens", label: "Tokens" },
  { id: "debug", label: "Debug" },
] as const;

export type DebugTab = (typeof DEBUG_TABS)[number]["id"];
