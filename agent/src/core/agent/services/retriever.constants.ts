export const RETRIEVER_CONFIG = {
  DEFAULT_LIMIT: 8,
  MIN_MATCH_SCORE: 0,
} as const;

export const MATCH_WEIGHTS = {
  KEYWORD: 0.6,
  DESCRIPTION: 0.3,
  NAME: 0.1,
} as const;

export const RETRIEVER_FALLBACK_TOOLS = ['web_search', 'list_files'] as const;
