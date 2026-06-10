export const STRATEGY_NAMES = {
  REACT: "react",
  NLAH: "nlah",
  STANDARD: "standard",
} as const;

export const STRATEGY_MAPPINGS = {
  REACT: ['react', 'agent'] as readonly string[],
  NLAH: ['nlah', 'deep-research'] as readonly string[],
  STANDARD: ['standard', 'chat'] as readonly string[],
} as const;
