export const DEEP_RESEARCH_CONFIG = {
  NAME: 'deep_web_research',
  DESCRIPTION: 'Performs deep web research by executing a query, finding relevant URLs, and spawning concurrent child crawler agents for each URL to extract and clean targeted data.',
  KEYWORDS: ['research', 'web', 'search', 'crawl', 'scrape', 'internet', 'browse', 'find', 'deep', 'url', 'website', 'online', 'look up'],
} as const;

export const SCHEMA_DESC = {
  QUERY: 'The search query to look up on the web',
  OBJECTIVE: 'The specific information/details to extract from the search results',
} as const;

export const OPERATION_STATUS = {
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

export const DUCKDUCKGO_CONFIG = {
  BASE_URL: (encodedQuery: string) => `https://html.duckduckgo.com/html/?q=${encodedQuery}`,
  ERROR_STATUS: (status: number) => `DuckDuckGo returned status ${status}`,
} as const;

export const PARSE_PATTERNS = {
  RESULT: /class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g,
  STRIP_TAGS: /<[^>]+>/g,
  SPACES: /\s+/g,
  UDDG: /uddg=([^&]+)/,
} as const;

export const SWARM_CONFIG = {
  QUEUE_NAME: 'deep-research-swarm-queue',
  DEFAULT_MAX_DEPTH: 2,
  DEFAULT_CONCURRENCY: 3,
  DEFAULT_MAX_RETRIES: 3,
  BACKOFF_DELAY_MS: 1000,
} as const;

export const RESEARCH_DEFAULTS = {
  DUCKDUCKGO_MAX_RESULTS: 5,
  MAX_TARGETS: 3,
  TENANT_ID: "subagent",
  CRAWLER_STRATEGY_NAME: "subagent-crawler",
  EMPTY_RESULT_FALLBACK: "Failed to extract content or page returned empty.",
  PACKET_CONTENT_TYPE: "content",
} as const;

export const HTTP_HEADERS = {
  USER_AGENT_KEY: "User-Agent",
  USER_AGENT_VALUE: "Mozilla/5.0 (compatible; EchoAgent/1.0)",
  ACCEPT_KEY: "Accept",
  ACCEPT_VALUE: "text/html",
} as const;

export const RESEARCH_LOGS = {
  START: (query: string, objective: string) => `Starting deep web research for query: "${query}" with objective: "${objective}"`,
  NO_RESULTS: (query: string) => `No web results found for query: "${query}".`,
  TARGETS: (found: number, slice: number) => `Found ${found} URLs. Spawning child crawler agents for top ${slice} targets.`,
  SPAWNING: (name: string, url: string) => `Spawning child crawler sub-agent: ${name} for URL: ${url}`,
  CRAWLER_OBJECTIVE: (url: string, objective: string) => `Scrape ${url} and extract: ${objective}`,
  CRAWLER_HUMAN_MESSAGE: (url: string, objective: string) => `Please scrape ${url} and extract: ${objective}`,
  CRAWLER_AGENT_NAME: (idx: number) => `crawler-agent-${idx}`,
  FAIL: 'Deep web research failed',
} as const;

export const RESEARCH_TEMPLATES = {
  SYNTHESIS_HEADER: `## Deep Web Research Synthesis\n`,
  QUERY: (query: string) => `**Query:** ${query}\n`,
  OBJECTIVE: (objective: string) => `**Objective:** ${objective}\n\n`,
  SOURCE_OVERVIEW: `### Source Overview\n`,
  SOURCE_LINE: (index: number, title: string, url: string) => `${index}. **[${title}](${url})**\n`,
  SEPARATOR: `\n---\n\n`,
  SOURCE_DETAIL_HEADER: (index: number, title: string) => `### [Source ${index}]: ${title}\n`,
  SOURCE_URL: (url: string) => `**URL:** ${url}\n\n`,
  FAIL_SUMMARY: (msg: string) => `Deep web research failed: ${msg}`,
} as const;
