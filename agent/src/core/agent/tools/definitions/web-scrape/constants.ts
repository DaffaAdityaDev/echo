export const SCRAPE_CONFIG = {
  NAME: 'web_scrape',
  DESCRIPTION: 'Scrapes main text content from a URL and returns a markdown preview of the content directly in the tool response.',
  KEYWORDS: ["scrape", "webpage", "url", "extract", "html", "content", "download"],
  SUBSTRING_LIMIT: 1000,
} as const;

export const SCRAPE_HEADERS = {
  USER_AGENT_KEY: 'User-Agent',
  USER_AGENT_VALUE: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 EchoAgent/1.0',
  ACCEPT_KEY: 'Accept',
  ACCEPT_VALUE: 'text/html,application/xhtml+xml,application/xml;q=0.9',
  ACCEPT_LANG_KEY: 'Accept-Language',
  ACCEPT_LANG_VALUE: 'en-US,en;q=0.9',
} as const;

export const SCHEMA_DESC = {
  URL: 'The absolute HTTP or HTTPS URL to fetch content from',
} as const;

export const OPERATION_STATUS = {
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

export const PARSE_PATTERNS = {
  HEAD: /<head[\s\S]*?<\/head>/gi,
  SCRIPT: /<script[\s\S]*?<\/script>/gi,
  STYLE: /<style[\s\S]*?<\/style>/gi,
  SVG: /<svg[\s\S]*?<\/svg>/gi,
  FOOTER: /<footer[\s\S]*?<\/footer>/gi,
  NAV: /<nav[\s\S]*?<\/nav>/gi,
  H1: /<h1[^>]*>([\s\S]*?)<\/h1>/gi,
  H2: /<h2[^>]*>([\s\S]*?)<\/h2>/gi,
  H3: /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
  H4: /<h4[^>]*>([\s\S]*?)<\/h4>/gi,
  P: /<p[^>]*>([\s\S]*?)<\/p>/gi,
  BR: /<br\s*\/?>/gi,
  LI: /<li[^>]*>([\s\S]*?)<\/li>/gi,
  A: /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  STRONG: /<strong[^>]*>([\s\S]*?)<\/strong>/gi,
  B: /<b[^>]*>([\s\S]*?)<\/b>/gi,
  EM: /<em[^>]*>([\s\S]*?)<\/em>/gi,
  I: /<i[^>]*>([\s\S]*?)<\/i>/gi,
  STRIP_TAGS: /<[^>]+>/g,
  NBSP: /&nbsp;/gi,
  AMP: /&amp;/gi,
  LT: /&lt;/gi,
  GT: /&gt;/gi,
  QUOT: /&quot;/gi,
  APOS: /&#39;/gi,
  MULTIPLE_NEWLINES: /\n\s*\n\s*\n+/g,
  MULTIPLE_SPACES: / +/g,
} as const;

export const SCRAPE_LOGS = {
  INFO_START: (url: string) => `Scraping webpage URL: ${url}`,
  ERROR_SCRAPING: (url: string) => `Failed to scrape URL: ${url}`,
} as const;

export const SCRAPE_SUMMARIES = {
  FAILURE: (status: number) => `Failed to scrape page. Server returned status: ${status}`,
  EMPTY_HTML: `Successfully fetched the page, but no readable text could be extracted.`,
  SUCCESS: (url: string, len: number) => `Scraped content from ${url} successfully. Length: ${len} characters.`,
  GENERIC_ERROR: (msg: string) => `Error occurred while scraping: ${msg}`,
  STATUS_ERROR_PAYLOAD: (status: number) => `Status code ${status}`,
} as const;
