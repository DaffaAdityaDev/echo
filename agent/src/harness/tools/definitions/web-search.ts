import { z } from 'zod';
import { ToolDefinition, Observation } from '../../types';

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
    const url = `https://html.duckduckgo.com/html/?q=${encoded}`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; EchoAgent/1.0)',
            'Accept': 'text/html',
        }
    });

    if (!response.ok) {
        throw new Error(`DuckDuckGo returned status ${response.status}`);
    }

    const html = await response.text();
    const results: DuckDuckGoResult[] = [];

    // Parse result blocks: <div class="result__body"> ...
    const resultPattern = /class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;

    while ((match = resultPattern.exec(html)) !== null && results.length < 5) {
        const rawUrl = match[1];
        const title = match[2].trim();
        const snippet = match[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

        // DuckDuckGo wraps URLs in a redirect — extract the real URL
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
        const cleanUrl = uddgMatch ? decodeURIComponent(uddgMatch[1]) : rawUrl;

        if (title && snippet) {
            results.push({ title, url: cleanUrl, snippet });
        }
    }

    return results;
}

const webSearchTool: ToolDefinition = {
    name: 'web_search',
    description: 'Search the web for real-time information, current events, weather, prices, or any topic that requires up-to-date data.',
    schema: z.object({
        query: z.string().describe('The search query to look for on the web')
    }),
    execute: async (input: { query: string }): Promise<Observation> => {
        try {
            const results = await searchDuckDuckGo(input.query);

            if (results.length === 0) {
                return {
                    status: 'warning',
                    summary: `No results found for: "${input.query}". Try rephrasing your search.`,
                    data: { results: [] }
                };
            }

            // Build a readable summary of top results
            const summary = results
                .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.snippet}\n   Source: ${r.url}`)
                .join('\n\n');

            return {
                status: 'success',
                summary: `Search results for "${input.query}":\n\n${summary}`,
                data: { results }
            };
        } catch (error: any) {
            return {
                status: 'error',
                summary: `Failed to search for "${input.query}": ${error.message}`,
                error: error.message
            };
        }
    }
};

export default webSearchTool;
