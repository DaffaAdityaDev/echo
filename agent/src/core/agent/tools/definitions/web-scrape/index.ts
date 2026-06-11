import { z } from 'zod';
import { chromium, Browser, BrowserContext } from 'playwright';
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

let globalBrowser: Browser | null = null;
let globalBrowserPromise: Promise<Browser> | null = null;

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

async function getBrowserInstance(): Promise<Browser> {
    if (globalBrowser) return globalBrowser;
    if (globalBrowserPromise) return globalBrowserPromise;

    globalBrowserPromise = (async () => {
        const launchOptions: any = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--disable-extensions',
                '--no-first-run',
                '--no-default-browser-check',
                '--no-zygote',
                '--disable-web-security'
            ]
        };

        if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
            launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
            logger.info(`Using system Chromium path: ${launchOptions.executablePath}`);
        }

        logger.info("Initializing singleton Playwright Chromium browser...");
        const browser = await chromium.launch(launchOptions);
        globalBrowser = browser;

        // Cleanup handler
        process.on('exit', () => {
            logger.info("Closing singleton browser instance...");
            browser.close().catch((err) => logger.error("Error closing browser on exit", err));
        });

        return browser;
    })();

    return globalBrowserPromise;
}

export const webScrapeTool: ToolDefinition = {
    name: SCRAPE_CONFIG.NAME,
    description: SCRAPE_CONFIG.DESCRIPTION,
    keywords: [...SCRAPE_CONFIG.KEYWORDS],
    schema: z.object({
        url: z.string().url().describe(SCHEMA_DESC.URL),
        actions: z.array(z.object({
            type: z.enum(['click', 'wait', 'fill']).describe('Type of interaction'),
            selector: z.string().describe('CSS selector to interact with'),
            value: z.string().optional().describe('Value to fill, or wait duration in milliseconds')
        })).optional().describe('Optional interactive user actions to perform before scraping')
    }),
    execute: async (
        input: { url: string; actions?: Array<{ type: 'click' | 'wait' | 'fill'; selector: string; value?: string }> }
    ): Promise<Observation> => {
        let html = '';
        let engineUsed: 'STATIC_CHEERIO' | 'DYNAMIC_PLAYWRIGHT' = 'STATIC_CHEERIO';

        try {
            logger.info(SCRAPE_LOGS.INFO_START(input.url));

            // ========================================================
            // STEP 1: FAST LANE (fetch + Cheerio) - Static/SSR websites
            // ========================================================
            let rawHtml = '';
            try {
                const response = await fetch(input.url, {
                    headers: {
                        [SCRAPE_HEADERS.USER_AGENT_KEY]: SCRAPE_HEADERS.USER_AGENT_VALUE,
                        [SCRAPE_HEADERS.ACCEPT_KEY]: SCRAPE_HEADERS.ACCEPT_VALUE,
                        [SCRAPE_HEADERS.ACCEPT_LANG_KEY]: SCRAPE_HEADERS.ACCEPT_LANG_VALUE,
                    }
                });

                if (response.ok) {
                    rawHtml = await response.text();
                }
            } catch (fetchErr: any) {
                logger.warn(`Fast lane fetch failed for URL ${input.url}: ${fetchErr.message}. Trying Playwright.`);
            }

            let isClientSideRendering = true;
            if (rawHtml) {
                const $ = cheerio.load(rawHtml);
                const bodyTextLength = $('body').text().trim().length;
                const hasAppRoot = $('#root').length > 0 || $('#app').length > 0 || rawHtml.includes('bundle.js') || rawHtml.includes('app.js');
                
                // Heuristic check: if there is substantial text and no empty client root container, treat as static
                isClientSideRendering = bodyTextLength < 250 && hasAppRoot;

                if (!isClientSideRendering) {
                    html = rawHtml;
                    engineUsed = 'STATIC_CHEERIO';
                    logger.info(`[⚡ Fast Lane] Scraped successfully using Cheerio (Static/SSR) for: ${input.url}`);
                }
            }

            // ========================================================
            // STEP 2: FALLBACK LANE (Playwright) - Dynamic/CSR/SPA websites
            // ========================================================
            if (isClientSideRendering) {
                logger.info(`[🐢 Fallback Lane] CSR detected or fetch failed. Activating Playwright for: ${input.url}`);
                let context: BrowserContext | null = null;
                try {
                    const browser = await getBrowserInstance();
                    context = await browser.newContext({
                        userAgent: SCRAPE_HEADERS.USER_AGENT_VALUE,
                        viewport: { width: 1280, height: 720 },
                        bypassCSP: true
                    });

                    const page = await context.newPage();

                    // Network interception (aggressive resource blocking)
                    await page.route('**/*', (route) => {
                        const request = route.request();
                        const resourceType = request.resourceType();
                        const url = request.url();

                        if (['stylesheet', 'image', 'font', 'media', 'other'].includes(resourceType)) {
                            return route.abort();
                        }
                        if (
                            /analytics|google-analytics|doubleclick|googleadservices|hotjar|mixpanel|segment|facebook|pixel|optimizely|amplitude/i.test(url) ||
                            /\.(css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|mp4|webm|mp3|ogg)$/i.test(url)
                        ) {
                            return route.abort();
                        }
                        return route.continue();
                    });

                    await page.goto(input.url, {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000
                    });

                    // Execute user interactions
                    if (input.actions && input.actions.length > 0) {
                        for (const action of input.actions) {
                            try {
                                if (action.type === 'click') {
                                    await page.click(action.selector, { timeout: 5000 });
                                } else if (action.type === 'wait') {
                                    const delay = parseInt(action.value || '1000', 10);
                                    await page.waitForTimeout(delay);
                                } else if (action.type === 'fill') {
                                    await page.fill(action.selector, action.value || '', { timeout: 5000 });
                                }
                            } catch (actionErr: any) {
                                logger.warn(`Scrape action failed: ${action.type} on ${action.selector}: ${actionErr.message}`);
                            }
                        }
                    }

                    html = await page.content();
                    engineUsed = 'DYNAMIC_PLAYWRIGHT';
                } catch (playwrightErr: any) {
                    logger.error(`[Playwright Fallback Failed] URL: ${input.url}`, playwrightErr);
                    // If Playwright itself fails to run (e.g. browser context errors), fall back to rawHtml if it was fetched
                    if (rawHtml) {
                        html = rawHtml;
                        engineUsed = 'STATIC_CHEERIO';
                        logger.warn(`Recovered via previous static rawHtml for: ${input.url}`);
                    } else {
                        throw playwrightErr;
                    }
                } finally {
                    if (context) {
                        await context.close().catch((err) => logger.error("Error closing context", err));
                    }
                }
            }

            // Convert raw HTML to markdown in main process using Turndown
            let markdown = '';
            if (html) {
                markdown = turndownService.turndown(html);
            }

            if (!markdown) {
                return {
                    status: OPERATION_STATUS.WARNING,
                    summary: SCRAPE_SUMMARIES.EMPTY_HTML,
                    data: { html: html.substring(0, 1000), engineUsed }
                };
            }

            return {
                status: OPERATION_STATUS.SUCCESS,
                summary: SCRAPE_SUMMARIES.SUCCESS(input.url, markdown.length) + ` (Engine: ${engineUsed})`,
                data: {
                    url: input.url,
                    markdown,
                    html,
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
