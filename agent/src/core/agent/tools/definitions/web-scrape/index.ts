import { z } from 'zod';
import { ToolDefinition, Observation } from '../../../../../shared/types';
import { logger } from '../../../../../shared/utils/logger';
import { 
    SCRAPE_CONFIG, 
    SCRAPE_HEADERS, 
    SCRAPE_LOGS, 
    SCRAPE_SUMMARIES, 
    SCHEMA_DESC, 
    OPERATION_STATUS, 
    PARSE_PATTERNS 
} from './constants';

function htmlToMarkdown(html: string): string {
    // Basic HTML parser using RegExp to clean it up and translate key tags to markdown
    let text = html;

    // Remove head, script, style, SVG, and footer tags
    text = text.replace(PARSE_PATTERNS.HEAD, '');
    text = text.replace(PARSE_PATTERNS.SCRIPT, '');
    text = text.replace(PARSE_PATTERNS.STYLE, '');
    text = text.replace(PARSE_PATTERNS.SVG, '');
    text = text.replace(PARSE_PATTERNS.FOOTER, '');
    text = text.replace(PARSE_PATTERNS.NAV, '');

    // Replace header tags with markdown counterparts
    text = text.replace(PARSE_PATTERNS.H1, '\n# $1\n');
    text = text.replace(PARSE_PATTERNS.H2, '\n## $1\n');
    text = text.replace(PARSE_PATTERNS.H3, '\n### $1\n');
    text = text.replace(PARSE_PATTERNS.H4, '\n#### $1\n');

    // Paragraphs & breaks
    text = text.replace(PARSE_PATTERNS.P, '\n$1\n');
    text = text.replace(PARSE_PATTERNS.BR, '\n');

    // List items
    text = text.replace(PARSE_PATTERNS.LI, '\n- $1');

    // Links: <a href="url">text</a> -> [text](url)
    text = text.replace(PARSE_PATTERNS.A, '[$2]($1)');

    // Bold/Italics
    text = text.replace(PARSE_PATTERNS.STRONG, '**$1**');
    text = text.replace(PARSE_PATTERNS.B, '**$1**');
    text = text.replace(PARSE_PATTERNS.EM, '*$1*');
    text = text.replace(PARSE_PATTERNS.I, '*$1*');

    // Strip remaining tags
    text = text.replace(PARSE_PATTERNS.STRIP_TAGS, ' ');

    // Normalize spacing
    text = text.replace(PARSE_PATTERNS.NBSP, ' ');
    text = text.replace(PARSE_PATTERNS.AMP, '&');
    text = text.replace(PARSE_PATTERNS.LT, '<');
    text = text.replace(PARSE_PATTERNS.GT, '>');
    text = text.replace(PARSE_PATTERNS.QUOT, '"');
    text = text.replace(PARSE_PATTERNS.APOS, "'");
    text = text.replace(PARSE_PATTERNS.MULTIPLE_NEWLINES, '\n\n');
    text = text.replace(PARSE_PATTERNS.MULTIPLE_SPACES, ' ');

    return text.trim();
}

export const webScrapeTool: ToolDefinition = {
    name: SCRAPE_CONFIG.NAME,
    description: SCRAPE_CONFIG.DESCRIPTION,
    keywords: [...SCRAPE_CONFIG.KEYWORDS],
    schema: z.object({
        url: z.string().url().describe(SCHEMA_DESC.URL)
    }),
    execute: async (input: { url: string }): Promise<Observation> => {
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
                return {
                    status: OPERATION_STATUS.ERROR,
                    summary: SCRAPE_SUMMARIES.FAILURE(response.status),
                    error: SCRAPE_SUMMARIES.STATUS_ERROR_PAYLOAD(response.status)
                };
            }

            const html = await response.text();
            const markdown = htmlToMarkdown(html);

            if (!markdown) {
                return {
                    status: OPERATION_STATUS.WARNING,
                    summary: SCRAPE_SUMMARIES.EMPTY_HTML,
                    data: { html: html.substring(0, SCRAPE_CONFIG.SUBSTRING_LIMIT) }
                };
            }

            return {
                status: OPERATION_STATUS.SUCCESS,
                summary: SCRAPE_SUMMARIES.SUCCESS(input.url, markdown.length),
                data: {
                    url: input.url,
                    markdown
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
