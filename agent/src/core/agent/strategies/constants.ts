export const STRATEGY_NAMES = {
  AGENT: "agent",
  STANDARD: "standard",
} as const;

export const STRATEGY_VERSIONS = {
  standard: "standard:v1",
  nlah: "nlah:v1",
} as const;

export const STRATEGY_VERSION_ALIASES = {
  "standard:v1": ["chat"],
  "nlah:v1": ["agent", "deep-research", "react", "sequential"],
} as const;
