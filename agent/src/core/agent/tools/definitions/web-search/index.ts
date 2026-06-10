import { z } from 'zod';
import { ToolDefinition, Observation } from '../../../../../shared/types';
import { SEARCH_CONFIG, HTTP_HEADERS, SEARCH_SUMMARIES, SCHEMA_DESC, OPERATION_STATUS, PARSE_PATTERNS } from './constants';

interface DuckDuckGoResult {
    title: string;
    url: string;
    snippet: string;
}

/**
 * Fetches search results from DuckDuckGo's HTML search page.
 * No API key required.
 */
async function searchDuckDuckGo(query: string): Promise<DuckDuckGoResult[]> {
    const encoded = encodeURIComponent(query);
    const url = SEARCH_CONFIG.DUCKDUCKGO_URL(encoded);

    const response = await fetch(url, {
        headers: {
            [HTTP_HEADERS.USER_AGENT_KEY]: HTTP_HEADERS.USER_AGENT_VALUE,
            [HTTP_HEADERS.ACCEPT_KEY]: HTTP_HEADERS.ACCEPT_VALUE,
        }
    });

    if (!response.ok) {
        throw new Error(SEARCH_SUMMARIES.HTTP_ERROR(response.status));
    }

    const html = await response.text();
    const results: DuckDuckGoResult[] = [];

    // Parse result blocks: <div class="result__body"> ...
    const resultPattern = PARSE_PATTERNS.RESULT;
    let match;

    while ((match = resultPattern.exec(html)) !== null && results.length < SEARCH_CONFIG.MAX_RESULTS) {
        const rawUrl = match[1];
        const title = match[2].trim();
        const snippet = match[3]
            .replace(PARSE_PATTERNS.STRIP_TAGS, '')
            .replace(PARSE_PATTERNS.NORMALIZE_SPACE, ' ')
            .trim();

        // DuckDuckGo wraps URLs in a redirect — extract the real URL
        const uddgMatch = rawUrl.match(PARSE_PATTERNS.REDIRECT_URL);
        const cleanUrl = uddgMatch ? decodeURIComponent(uddgMatch[1]) : rawUrl;

        if (title && snippet) {
            results.push({ title, url: cleanUrl, snippet });
        }
    }

    return results;
}

const webSearchTool: ToolDefinition = {
    name: SEARCH_CONFIG.NAME,
    description: SEARCH_CONFIG.DESCRIPTION,
    keywords: [...SEARCH_CONFIG.KEYWORDS],
    schema: z.object({
        query: z.string().describe(SCHEMA_DESC.QUERY)
    }),
    execute: async (input: { query: string }): Promise<Observation> => {
        try {
            const results = await searchDuckDuckGo(input.query);

            if (results.length === 0) {
                return {
                    status: OPERATION_STATUS.WARNING,
                    summary: SEARCH_SUMMARIES.EMPTY_RESULTS(input.query),
                    data: { results: [] }
                };
            }

            // Build a readable summary of top results
            const summaryBody = results
                .map((r, i) => SEARCH_SUMMARIES.LINE_ITEM(i, r.title, r.snippet, r.url))
                .join('\n\n');

            return {
                status: OPERATION_STATUS.SUCCESS,
                summary: `${SEARCH_SUMMARIES.SUCCESS_HEADER(input.query)}${summaryBody}`,
                data: { results }
            };
        } catch (error: any) {
            return {
                status: OPERATION_STATUS.ERROR,
                summary: SEARCH_SUMMARIES.GENERIC_ERROR(input.query, error.message),
                error: error.message
            };
        }
    }
};

export default webSearchTool;
