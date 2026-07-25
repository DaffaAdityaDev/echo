export const STUDIO_ENDPOINTS = {
  PROMPTS: '/studio/prompts',
  PROMPTS_ACTIVE: (name: string) => `/studio/prompts/active?name=${encodeURIComponent(name)}`,
  PROMPT_VERSIONS: (id: string) => `/studio/prompts/${id}/versions`,
  PROMPT_VERSION: (id: string, v: number) => `/studio/prompts/${id}/versions/${v}`,
  PROMPT_PROMOTE: (id: string, v: number) => `/studio/prompts/${id}/promote/${v}`,
  PROMPT_ROLLBACK: (id: string, v: number) => `/studio/prompts/${id}/rollback/${v}`,
  EVAL_DATASETS: '/studio/evals/datasets',
  EVAL_RUN: '/studio/evals/run',
  EVAL_RUNS: '/studio/evals/runs',
  EVAL_RESULT: (id: string) => `/studio/evals/runs/${id}`,
  SHADOW: '/studio/shadow',
  SHADOW_HISTORY: (id: string) => `/studio/shadow/history/${id}`,
  AUDIT: '/studio/audit',
  MATURITY: '/studio/maturity',
  MATURITY_CLIENT: '/studio/maturity/client',
  PLAYGROUND: '/studio/playground',
} as const

export const STUDIO_QUERY_KEYS = {
  PROMPTS: ['studio', 'prompts'] as const,
  PROMPT_VERSIONS: (id: string) => ['studio', 'prompts', id, 'versions'] as const,
  EVAL_RUNS: ['studio', 'evals', 'runs'] as const,
  SHADOW: ['studio', 'shadow'] as const,
  AUDIT: ['studio', 'audit'] as const,
  MATURITY: ['studio', 'maturity'] as const,
} as const
