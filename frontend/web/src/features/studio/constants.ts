export const STUDIO_ENDPOINTS = {
  PROMPTS: "/studio/prompts",
  PROMPTS_ACTIVE: (name: string) => `/studio/prompts/active?name=${encodeURIComponent(name)}`,
  PROMPT_VERSIONS: (id: string) => `/studio/prompts/${id}/versions`,
  PROMPT_VERSION: (id: string, v: number) => `/studio/prompts/${id}/versions/${v}`,
  PROMPT_PROMOTE: (id: string, v: number) => `/studio/prompts/${id}/promote/${v}`,
  PROMPT_ROLLBACK: (id: string, v: number) => `/studio/prompts/${id}/rollback/${v}`,
  MATURITY: "/studio/maturity",
  MATURITY_CLIENT: "/studio/maturity/client",
} as const;

export const STUDIO_QUERY_KEYS = {
  PROMPTS: ["studio", "prompts"] as const,
  PROMPT_VERSIONS: (id: string) => ["studio", "prompts", id, "versions"] as const,
  MATURITY: ["studio", "maturity"] as const,
} as const;
