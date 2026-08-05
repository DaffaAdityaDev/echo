export const ANCHOR_VERSIONS = {
  STANDARD: "standard",
} as const;

export const ANCHOR_TEMPLATES = {
  STANDARD_ANCHOR: (year: number | string) => `<context_anchor>Current_Year: ${year}</context_anchor>`,
} as const;
