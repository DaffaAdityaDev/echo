export const LOCAL_URL_KEYWORDS = [
  "localhost",
  "127.0.0.1",
  "lm-studio",
  "local",
  "192.168.",
  "10."
] as const;

export const PRICING_MODELS = {
  GPT_4O_MINI: {
    pattern: 'gpt-4o-mini',
    inputRate: 0.15,
    outputRate: 0.60,
    cacheReadRate: 0.075,
  },
  GPT_4O: {
    pattern: 'gpt-4o',
    inputRate: 2.50,
    outputRate: 10.00,
    cacheReadRate: 1.25,
  },
  CLAUDE_3_5_SONNET: {
    pattern: 'claude-3-5-sonnet',
    inputRate: 3.00,
    outputRate: 15.00,
    cacheReadRate: 0.30,
  },
  DEFAULT: {
    inputRate: 1.50,
    outputRate: 6.00,
    cacheReadRate: 0.75,
  }
} as const;
