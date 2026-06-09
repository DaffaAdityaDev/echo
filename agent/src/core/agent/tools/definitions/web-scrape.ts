import { z } from 'zod';
import { ToolDefinition, Observation } from '../../../../shared/types';
import { logger } from '../../../../shared/utils/logger';

function htmlToMarkdown(html: string): string {
    // Basic HTML parser using RegExp to clean it up and translate key tags to markdown
    let text = html;

    // Remove head, script, style, SVG, and footer tags
    text = text.replace(/<head[\s\S]*?<\/head>/gi, '');
    text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<svg[\s\S]*?<\/svg>/gi, '');
    text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');

    // Replace header tags with markdown counterparts
    text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
    text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
    text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
    text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');

    // Paragraphs & breaks
    text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // List items
    text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');

    // Links: <a href="url">text</a> -> [text](url)
    text = text.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

    // Bold/Italics
    text = text.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
    text = text.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
    text = text.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
    text = text.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

    // Strip remaining tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Normalize spacing
    text = text.replace(/&nbsp;/gi, ' ');
    text = text.replace(/&amp;/gi, '&');
    text = text.replace(/&lt;/gi, '<');
    text = text.replace(/&gt;/gi, '>');
    text = text.replace(/&quot;/gi, '"');
    text = text.replace(/&#39;/gi, "'");
    text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
    text = text.replace(/ +/g, ' ');

    return text.trim();
}

export const webScrapeTool: ToolDefinition = {
    name: 'web_scrape',
    description: 'Scrapes main text content from a URL.',
    keywords: ["scrape", "webpage", "url", "extract", "html", "content", "download"],
    schema: z.object({
        url: z.string().url().describe('The absolute HTTP or HTTPS URL to fetch content from')
    }),
    execute: async (input: { url: string }): Promise<Observation> => {
        try {
            logger.info(`Scraping webpage URL: ${input.url}`);
            
            const response = await fetch(input.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 EchoAgent/1.0',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });

            if (!response.ok) {
                return {
                    status: 'error',
                    summary: `Failed to scrape page. Server returned status: ${response.status}`,
                    error: `Status code ${response.status}`
                };
            }

            const html = await response.text();
            const markdown = htmlToMarkdown(html);

            if (!markdown) {
                return {
                    status: 'warning',
                    summary: `Successfully fetched the page, but no readable text could be extracted.`,
                    data: { html: html.substring(0, 1000) }
                };
            }

            return {
                status: 'success',
                summary: `Scraped content from ${input.url} successfully. Length: ${markdown.length} characters.`,
                data: {
                    url: input.url,
                    markdown
                }
            };
        } catch (error: any) {
            logger.error(`Failed to scrape URL: ${input.url}`, error);
            return {
                status: 'error',
                summary: `Error occurred while scraping: ${error.message}`,
                error: error.message
            };
        }
    }
};

export default webScrapeTool;
