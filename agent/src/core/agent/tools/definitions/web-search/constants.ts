export const SEARCH_CONFIG = {
  NAME: 'web_search',
  DESCRIPTION: 'Web search engine for real-time weather, prices, and current events.',
  KEYWORDS: ["search", "web", "google", "query", "weather", "prices", "current events"],
  MAX_RESULTS: 5,
  DUCKDUCKGO_URL: (encodedQuery: string) => `https://html.duckduckgo.com/html/?q=${encodedQuery}`,
} as const;

export const HTTP_HEADERS = {
  USER_AGENT_KEY: 'User-Agent',
  USER_AGENT_VALUE: 'Mozilla/5.0 (compatible; EchoAgent/1.0)',
  ACCEPT_KEY: 'Accept',
  ACCEPT_VALUE: 'text/html',
} as const;

export const SCHEMA_DESC = {
  QUERY: 'The search query to look for on the web',
} as const;

export const OPERATION_STATUS = {
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

export const PARSE_PATTERNS = {
  RESULT: /class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g,
  STRIP_TAGS: /<[^>]+>/g,
  NORMALIZE_SPACE: /\s+/g,
  REDIRECT_URL: /uddg=([^&]+)/,
} as const;

export const SEARCH_SUMMARIES = {
  HTTP_ERROR: (status: number) => `DuckDuckGo returned status ${status}`,
  EMPTY_RESULTS: (query: string) => `No results found for: "${query}". Try rephrasing your search.`,
  SUCCESS_HEADER: (query: string) => `Search results for "${query}":\n\n`,
  LINE_ITEM: (idx: number, title: string, snippet: string, url: string) => 
    `${idx + 1}. **${title}**\n   ${snippet}\n   Source: ${url}`,
  GENERIC_ERROR: (query: string, msg: string) => `Failed to search for "${query}": ${msg}`,
} as const;
