import { z } from 'zod';
import TurndownService from 'turndown';
import * as cheerio from 'cheerio';
import { ToolDefinition, Observation } from '../../../../../shared/types';
import { logger } from '../../../../../shared/utils/logger';
import { 
    SCRAPE_CONFIG, 
    SCRAPE_HEADERS, 
    SCRAPE_LOGS, 
    SCRAPE_SUMMARIES, 
    SCHEMA_DESC, 
    OPERATION_STATUS 
} from './constants';

// Initialize the turndown service with custom clean rules
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    hr: '---'
});

// Remove unnecessary tags completely from markdown output
turndownService.addRule('remove-useless', {
    filter: ['script', 'style', 'noscript', 'iframe', 'svg', 'nav', 'footer', 'header', 'link', 'meta'],
    replacement: () => ''
});

export const webScrapeTool: ToolDefinition = {
    name: SCRAPE_CONFIG.NAME,
    description: SCRAPE_CONFIG.DESCRIPTION,
    keywords: [...SCRAPE_CONFIG.KEYWORDS],
    schema: z.object({
        url: z.string().url().describe(SCHEMA_DESC.URL)
    }),
    execute: async (
        input: { url: string }
    ): Promise<Observation> => {
        let html = '';
        const engineUsed = 'STATIC_CHEERIO';

        try {
            logger.info(SCRAPE_LOGS.INFO_START(input.url));

            const response = await fetch(input.url, {
                headers: {
                    [SCRAPE_HEADERS.USER_AGENT_KEY]: SCRAPE_HEADERS.USER_AGENT_VALUE,
                    [SCRAPE_HEADERS.ACCEPT_KEY]: SCRAPE_HEADERS.ACCEPT_VALUE,
                    [SCRAPE_HEADERS.ACCEPT_LANG_KEY]: SCRAPE_HEADERS.ACCEPT_LANG_VALUE,
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
            }

            html = await response.text();
            logger.info(`[⚡ Fast Lane] Scraped successfully using Cheerio (Static/SSR) for: ${input.url}`);

            // Clean HTML: strip boilerplate before extraction + conversion
            let markdown = '';
            let structure: string[] = [];
            let paragraphs: string[] = [];
            if (html) {
                const $clean = cheerio.load(html);
                $clean('nav, footer, header, script, style, noscript, iframe, svg, link, meta, .ads, #sidebar, .sidebar, .menu, .footer, .header, .advertisement, .banner, .nav').remove();

                // 1. Page structure with markdown hierarchy (h1-h6)
                const seen = new Set<string>();
                $clean('h1, h2, h3, h4, h5, h6').each((i, el) => {
                    const tag = el.tagName.toLowerCase();
                    const text = $clean(el).text().trim().replace(/\s+/g, ' ');
                    if (text && text.length > 5 && !seen.has(text) && seen.size < 8) {
                        seen.add(text);
                        const level = parseInt(tag.replace('h', '')) || 1;
                        const indent = '  '.repeat(level - 1);
                        structure.push(`${indent}- ${text}`);
                    }
                });

                // 2. First meaningful paragraphs
                $clean('p').each((i, el) => {
                    const text = $clean(el).text().trim().replace(/\s+/g, ' ');
                    if (text.length > 100 && paragraphs.length < 3) {
                        paragraphs.push(text);
                    }
                });

                const cleanHtml = $clean.html();
                markdown = turndownService.turndown(cleanHtml);
            }

            if (!markdown) {
                return {
                    status: OPERATION_STATUS.WARNING,
                    summary: SCRAPE_SUMMARIES.EMPTY_HTML,
                    data: { html: html ? html.substring(0, 1000) : '', engineUsed }
                };
            }

            // Fallback: if no paragraphs found, grab first clean 500 chars of markdown
            const keyContent = paragraphs.length > 0
                ? paragraphs.join('\n\n')
                : markdown.replace(/[#*`\n]+/g, ' ').trim().substring(0, 500);

            const previewLimit = 1500;
            const preview = markdown.length > previewLimit
                ? markdown.substring(0, previewLimit) + `\n\n... [truncated, full: ${markdown.length} chars]`
                : markdown;

            let summary = `${SCRAPE_SUMMARIES.SUCCESS(input.url, markdown.length)} (Engine: ${engineUsed})`;
            if (structure.length > 0) {
                summary += `\n\n## Page Structure\n${structure.join('\n')}`;
            }
            summary += `\n\n## Key Content\n${keyContent}`;
            summary += `\n\n## Content Preview\n${preview}`;

            return {
                status: OPERATION_STATUS.SUCCESS,
                summary,
                data: {
                    url: input.url,
                    markdown,
                    html,
                    structure,
                    engineUsed
                }
            };

        } catch (error: any) {
            logger.error(SCRAPE_LOGS.ERROR_SCRAPING(input.url), error);
            return {
                status: OPERATION_STATUS.ERROR,
                summary: SCRAPE_SUMMARIES.GENERIC_ERROR(error.message),
                error: error.message
            };
        }
    }
};

export default webScrapeTool;

