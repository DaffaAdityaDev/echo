import { z } from 'zod';
import { ToolDefinition, Observation, LLMProvider } from '../../../../../shared/types';
import { logger } from '../../../../../shared/utils/logger';
import { HumanMessage } from '@langchain/core/messages';
import webScrapeTool from '../web-scrape';
import * as cheerio from 'cheerio';
import { langfuseStorage } from '../../../../../utils/langfuse';

import { 
    HTTP_HEADERS, 
    RESEARCH_DEFAULTS, 
    DEEP_RESEARCH_CONFIG, 
    SCHEMA_DESC, 
    OPERATION_STATUS, 
    DUCKDUCKGO_CONFIG, 
    PARSE_PATTERNS,
    SWARM_CONFIG,
    RESEARCH_TEMPLATES
} from './constants';
import { 
    generateExtractorPrompt, 
    generateCriticPrompt, 
    generateSynthesisPrompt 
} from './prompts';

interface DuckDuckGoResult {
    title: string;
    url: string;
    snippet: string;
}

// Semaphore class for concurrency control in fallback local mode
class Semaphore {
    private active = 0;
    private queue: (() => void)[] = [];
    constructor(private max: number) {}
    async acquire() {
        if (this.active < this.max) {
            this.active++;
            return;
        }
        return new Promise<void>((resolve) => {
            this.queue.push(resolve);
        });
    }
    release() {
        this.active--;
        const next = this.queue.shift();
        if (next) {
            this.active++;
            next();
        }
    }
}

// Resilient helper to parse JSON outputs from LLMs (handling local models markdown tags)
function parseJSONSafe(text: string): { facts: string[]; internalLinks: string[] } {
    const cleaned = text.trim();
    try {
        return JSON.parse(cleaned);
    } catch {
        const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = cleaned.match(jsonBlockRegex);
        if (match && match[1]) {
            try {
                return JSON.parse(match[1].trim());
            } catch {}
        }

        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            try {
                return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
            } catch {}
        }
    }
    return { facts: [], internalLinks: [] };
}

function parseCriticJSONSafe(text: string): { status: 'PASS' | 'FAIL'; reason: string } {
    const cleaned = text.trim();
    try {
        return JSON.parse(cleaned);
    } catch {
        const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
        const match = cleaned.match(jsonBlockRegex);
        if (match && match[1]) {
            try {
                return JSON.parse(match[1].trim());
            } catch {}
        }

        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            try {
                return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
            } catch {}
        }
    }
    return { status: 'FAIL', reason: 'Failed to parse critic output.' };
}

// Call LLM provider directly to avoid full agent harness iteration overhead
async function callLLM(provider: LLMProvider, systemPrompt: string, userMessage: string): Promise<string> {
    const messages = [new HumanMessage(userMessage)];
    const stream = provider.stream(messages, [], systemPrompt);
    let output = "";
    for await (const chunk of stream) {
        if (chunk.content) {
            output += chunk.content;
        }
    }
    return output;
}

// Resilient timeout helper to prevent backend backpressure and hung connections
function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
    let timeoutId: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errorMsg)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}



// Normalise internal links to same domain, filter utility pages, and ensure relevance to objective/query keywords
function extractAndNormalizeLinks(baseUrl: string, rawLinks: string[], keywords: string[]): string[] {
    const normalized: string[] = [];
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    try {
        const base = new URL(baseUrl);
        for (const link of rawLinks) {
            try {
                const resolved = new URL(link, baseUrl);
                if (resolved.host === base.host || resolved.host.endsWith('.' + base.host)) {
                    const pathname = resolved.pathname.toLowerCase();
                    
                    // Filter out standard utility/structural paths
                    if (/(sign[-_]?in|sign[-_]?up|login|register|logout|members|profile|settings|help|privacy|terms|about|contact|legal|cart|checkout|faq|support)/.test(pathname)) {
                        continue;
                    }

                    if (!/\.(jpg|jpeg|png|gif|pdf|zip|tar|gz|mp4|mp3|exe|dmg|svg)$/.test(pathname)) {
                        resolved.hash = "";
                        
                        const urlString = resolved.href.toLowerCase();
                        // If we have keywords, ensure the URL path contains at least one of them to keep research focused
                        const hasKeyword = lowerKeywords.length === 0 || lowerKeywords.some(kw => urlString.includes(kw));
                        
                        if (hasKeyword) {
                            normalized.push(resolved.href);
                        }
                    }
                }
            } catch (err) {}
        }
    } catch (err) {}
    return Array.from(new Set(normalized));
}


// Scrape search results from DuckDuckGo
async function searchDuckDuckGo(query: string): Promise<DuckDuckGoResult[]> {
    const encoded = encodeURIComponent(query);
    const url = DUCKDUCKGO_CONFIG.BASE_URL(encoded);

    const response = await withTimeout(
        fetch(url, {
            headers: {
                [HTTP_HEADERS.USER_AGENT_KEY]: HTTP_HEADERS.USER_AGENT_VALUE,
                [HTTP_HEADERS.ACCEPT_KEY]: HTTP_HEADERS.ACCEPT_VALUE,
            }
        }),
        10000,
        "DuckDuckGo search request timed out after 10s"
    );

    if (!response.ok) {
        throw new Error(DUCKDUCKGO_CONFIG.ERROR_STATUS(response.status));
    }

    const html = await response.text();
    const results: DuckDuckGoResult[] = [];

    const resultPattern = PARSE_PATTERNS.RESULT;
    let match;

    while ((match = resultPattern.exec(html)) !== null && results.length < RESEARCH_DEFAULTS.DUCKDUCKGO_MAX_RESULTS) {
        const rawUrl = match[1];
        const title = match[2].trim();
        const snippet = match[3].replace(PARSE_PATTERNS.STRIP_TAGS, '').replace(PARSE_PATTERNS.SPACES, ' ').trim();

        const uddgMatch = rawUrl.match(PARSE_PATTERNS.UDDG);
        const cleanUrl = uddgMatch ? decodeURIComponent(uddgMatch[1]) : rawUrl;

        if (title && snippet) {
            results.push({ title, url: cleanUrl, snippet });
        }
    }

    return results;
}

export const deep_web_research: ToolDefinition = {
    name: DEEP_RESEARCH_CONFIG.NAME,
    description: DEEP_RESEARCH_CONFIG.DESCRIPTION,
    keywords: [...DEEP_RESEARCH_CONFIG.KEYWORDS],
    schema: z.object({
        query: z.string().describe(SCHEMA_DESC.QUERY),
        objective: z.string().describe(SCHEMA_DESC.OBJECTIVE)
    }),
    execute: async (
        input: { query: string; objective: string }, 
        config?: { parentMessages?: any[]; onPacket?: (p: any) => Promise<void>; provider?: LLMProvider }
    ): Promise<Observation> => {
        const missionId = crypto.randomUUID();
        const provider = config?.provider;
        if (!provider) {
            throw new Error("LLMProvider is required for deep web research");
        }

        const store = langfuseStorage.getStore();
        const parentMissionId = store?.sessionId || "standalone";

        logger.agentActivity(parentMissionId, 'SWARM_START', `Starting swarm research query: "${input.query}"`, { 
            swarmMissionId: missionId,
            objective: input.objective 
        });

        // 1. Get seed URLs from DuckDuckGo
        let seedResults: DuckDuckGoResult[] = [];
        try {
            seedResults = await searchDuckDuckGo(input.query);
        } catch (err: any) {
            logger.error(`DuckDuckGo query search failed: ${err.message}`);
        }

        if (seedResults.length === 0) {
            logger.agentActivity(parentMissionId, 'SWARM_WARN', `No initial seed URLs discovered for query: "${input.query}"`);
            return {
                status: OPERATION_STATUS.WARNING,
                summary: `No initial seed URLs discovered for query: "${input.query}"`,
                data: { results: [] }
            };
        }

        const seedUrls = seedResults.slice(0, RESEARCH_DEFAULTS.MAX_TARGETS).map(r => r.url);
        logger.agentActivity(parentMissionId, 'SWARM_SEED_FOUND', `Discovered ${seedUrls.length} seed URLs.`, { urls: seedUrls });

        // Extract key terms for focused crawling relevance filtering
        const seedKeywords = seedResults.map(r => r.title + " " + r.url)
            .join(" ")
            .split(/[^a-zA-Z0-9]/)
            .map(k => k.trim().toLowerCase())
            .filter(k => k.length > 3 && !['http', 'https', 'www', 'html', 'aspx', 'php', 'index', 'page', 'about', 'contact', 'search', 'query', 'extract', 'details', 'upcoming', 'update'].includes(k));
            
        const queryKeywords = Array.from(new Set([
            ...input.query.split(/[^a-zA-Z0-9]/).map(k => k.trim().toLowerCase()),
            ...input.objective.split(/[^a-zA-Z0-9]/).map(k => k.trim().toLowerCase()),
            ...seedKeywords
        ])).filter(k => k.length > 2 && !['http', 'https', 'www', 'html', 'aspx', 'php', 'index', 'page', 'about', 'contact', 'search', 'query', 'extract', 'details', 'upcoming', 'update', 'current', 'real-time', 'weather', 'source', 'sources', 'news', 'find'].includes(k));


        
        // 2. State & Queue definitions
        const visitedUrls = new Set<string>();
        const discoveryQueue: { url: string; depth: number }[] = [];
        const allSourceResults: Array<{ url: string; title: string; facts: string[] }> = [];

        for (const url of seedUrls) {
            visitedUrls.add(url);
            discoveryQueue.push({ url, depth: 1 });
        }

        // ==========================================
        // LOCAL IN-MEMORY SWARM PIPELINE
        // ==========================================
        let currentDepth = 1;
        const maxDepth = SWARM_CONFIG.DEFAULT_MAX_DEPTH;
        let activeLevelUrls = [...seedUrls];

        while (activeLevelUrls.length > 0 && currentDepth <= maxDepth) {
            logger.agentActivity(parentMissionId, 'SWARM_DEPTH_START', `[Local] Starting depth level ${currentDepth} containing ${activeLevelUrls.length} pages.`, { depth: currentDepth, count: activeLevelUrls.length });
            await config?.onPacket?.({
                type: 'reasoning',
                content: `\n[Local Swarm Depth ${currentDepth}] Starting level containing ${activeLevelUrls.length} pages.`
            });

            const semaphore = new Semaphore(SWARM_CONFIG.DEFAULT_CONCURRENCY);
            const nextLevelUrls: string[] = [];

            const levelPromises = activeLevelUrls.map(async (url) => {
                await semaphore.acquire();
                try {
                    logger.agentActivity(parentMissionId, 'SWARM_SCRAPE_START', `[Local Depth ${currentDepth}] Worker starting to scrape URL: ${url}`, { url, depth: currentDepth });
                    await config?.onPacket?.({
                        type: 'reasoning',
                        content: `\n[Local Swarm Depth ${currentDepth}] Spawning agent worker (concurrency: ${SWARM_CONFIG.DEFAULT_CONCURRENCY} active).\n` +
                                 ` 🌐 Crawling: ${url}\n` +
                                 ` 👥 Swarm Active Size: ${SWARM_CONFIG.DEFAULT_CONCURRENCY} concurrent agents\n` +
                                 ` ⏳ Est. level wait: ~${Math.ceil((activeLevelUrls?.length || 1) / SWARM_CONFIG.DEFAULT_CONCURRENCY) * 15}s`
                    });
                    await config?.onPacket?.({
                        type: 'swarm_status',
                        swarm: {
                            status: 'crawling',
                            depth: currentDepth,
                            url,
                            activeAgents: SWARM_CONFIG.DEFAULT_CONCURRENCY,
                            estTime: `${Math.ceil((activeLevelUrls?.length || 1) / SWARM_CONFIG.DEFAULT_CONCURRENCY) * 15}s`,
                            message: `Spawning agent worker`
                        }
                    });

                    const scrapeResult = await withTimeout(
                        webScrapeTool.execute({ url }),
                        15000,
                        `ETL scrape timed out after 15s for URL: ${url}`
                    );
                    if (scrapeResult.status !== 'success' || !scrapeResult.data?.markdown) {
                        logger.agentActivity(parentMissionId, 'SWARM_SCRAPE_FAIL', `[Local] Worker ETL scrape failed for URL: ${url}`, { url });
                        await config?.onPacket?.({
                            type: 'reasoning',
                            content: `\n[Local Swarm Worker Scrape Failed] URL: ${url} (unreachable or blocked)`
                        });
                        return;
                    }

                    const markdown = scrapeResult.data.markdown;
                    const html = scrapeResult.data.html || '';
                    const title = scrapeResult.summary.split("from")[0]?.trim() || url;
                    const engine = scrapeResult.data.engineUsed || 'unknown';
                    logger.agentActivity(parentMissionId, 'SWARM_SCRAPE_SUCCESS', `[Local] Successfully scraped ${url} (Markdown: ${markdown.length} chars, Engine: ${engine})`, { url, engine, title });

                    // Extract links using Cheerio in memory
                    const discoveredLinks: string[] = [];
                    if (html) {
                        try {
                            const $ = cheerio.load(html);
                            $('a').each((_, element) => {
                                const href = $(element).attr('href');
                                if (href) {
                                    discoveredLinks.push(href);
                                }
                            });
                            logger.agentActivity(parentMissionId, 'SWARM_LINKS_EXTRACTED', `[Local] Extracted ${discoveredLinks.length} raw links via Cheerio for: ${url}`, { url, count: discoveredLinks.length });
                        } catch (cheerioErr: any) {
                            logger.error(`Cheerio link extraction failed for URL: ${url}`, cheerioErr);
                        }
                    }

                    // Extraction & Critic
                    let attempts = 0;
                    let success = false;
                    let feedback = "";
                    let facts: string[] = [];

                    while (attempts < SWARM_CONFIG.DEFAULT_MAX_RETRIES && !success) {
                        attempts++;
                        
                        logger.agentActivity(parentMissionId, 'SWARM_EXTRACT_ATTEMPT', `[Local] Attempt ${attempts}/${SWARM_CONFIG.DEFAULT_MAX_RETRIES}: Extracting facts from ${url}`, { url, attempt: attempts });
                        await config?.onPacket?.({
                            type: 'reasoning',
                            content: `\n[Local Swarm Worker LL] Scraped ${url}\n` +
                                     `  📊 Cleaned size: ${markdown.length} chars (Engine: ${engine})\n` +
                                     `  🔗 Discovered: ${discoveredLinks.length} internal links\n` +
                                     `  🧠 Extracting facts (attempt ${attempts}/${SWARM_CONFIG.DEFAULT_MAX_RETRIES})...`
                        });
                        await config?.onPacket?.({
                            type: 'swarm_status',
                            swarm: {
                                status: 'scraped',
                                depth: currentDepth,
                                url,
                                activeAgents: SWARM_CONFIG.DEFAULT_CONCURRENCY,
                                dataSize: markdown.length,
                                discoveredLinks: discoveredLinks.length,
                                message: `Scraped page content (attempt ${attempts}/${SWARM_CONFIG.DEFAULT_MAX_RETRIES})`
                            }
                        });

                        const extractPrompt = generateExtractorPrompt(markdown, input.objective);
                        const systemPrompt = feedback 
                            ? `Correct previous work based on critic feedback: ${feedback}`
                            : `Extract key facts relevant to objective.`;
                        
                        const extractionRaw = await withTimeout(
                            callLLM(provider, systemPrompt, extractPrompt),
                            60000,
                            `LLM extraction timed out after 60s for URL: ${url}`
                        );
                        const extracted = parseJSONSafe(extractionRaw);
                        facts = extracted.facts;
                        logger.agentActivity(parentMissionId, 'SWARM_FACTS_EXTRACTED', `[Local] Extracted ${facts.length} facts from ${url}`, { url, count: facts.length });
                        if (extracted.internalLinks && Array.isArray(extracted.internalLinks)) {
                            discoveredLinks.push(...extracted.internalLinks);
                        }

                        logger.agentActivity(parentMissionId, 'SWARM_CRITIC_START', `[Local] QA Critic validating facts for ${url}`, { url, factsCount: facts.length });
                        await config?.onPacket?.({
                            type: 'reasoning',
                            content: `\n[Local Swarm QA Critic] Validating ${facts.length} extracted facts for URL: ${url}`
                        });
                        await config?.onPacket?.({
                            type: 'swarm_status',
                            swarm: {
                                status: 'critic_validating',
                                depth: currentDepth,
                                url,
                                activeAgents: SWARM_CONFIG.DEFAULT_CONCURRENCY,
                                factsCount: facts.length,
                                message: `QA Critic validating ${facts.length} extracted facts`
                            }
                        });

                        const criticPrompt = generateCriticPrompt(markdown, facts, input.objective);
                        const criticRaw = await withTimeout(
                            callLLM(provider, `Verify extracted details.`, criticPrompt),
                            60000,
                            `QA Critic validation timed out after 60s for URL: ${url}`
                        );
                        const criticResult = parseCriticJSONSafe(criticRaw);

                        if (criticResult.status === 'PASS') {
                            success = true;
                            logger.agentActivity(parentMissionId, 'SWARM_CRITIC_PASS', `[Local] Critic PASSED verification for ${url}`, { url });
                            await config?.onPacket?.({
                                type: 'reasoning',
                                content: `\n[Local Swarm QA Passed] Critic verified facts for: ${url} (PASS)`
                            });
                            await config?.onPacket?.({
                                type: 'swarm_status',
                                swarm: {
                                    status: 'critic_passed',
                                    depth: currentDepth,
                                    url,
                                    activeAgents: SWARM_CONFIG.DEFAULT_CONCURRENCY,
                                    factsCount: facts.length,
                                    message: `Critic verified facts (PASS)`
                                }
                            });
                        } else {
                            feedback = criticResult.reason;
                            logger.agentActivity(parentMissionId, 'SWARM_CRITIC_FAIL', `[Local] Critic FAILED verification for ${url}. Reason: ${feedback}`, { url, feedback });
                            await config?.onPacket?.({
                                type: 'reasoning',
                                content: `\n[Local Swarm QA Failed] Critic rejected facts for: ${url} (FAIL)\n` +
                                         ` ❌ Reason: ${feedback}`
                            });
                            await config?.onPacket?.({
                                type: 'swarm_status',
                                swarm: {
                                    status: 'critic_failed',
                                    depth: currentDepth,
                                    url,
                                    activeAgents: SWARM_CONFIG.DEFAULT_CONCURRENCY,
                                    feedback,
                                    message: `Critic rejected facts (FAIL)`
                                }
                            });

                            const delay = SWARM_CONFIG.BACKOFF_DELAY_MS * Math.pow(2, attempts - 1);
                            await new Promise((resolve) => setTimeout(resolve, delay));
                        }
                    }


                    if (facts.length > 0) {
                        allSourceResults.push({ url, title, facts });
                    }
                    logger.agentActivity(parentMissionId, 'SWARM_WORKER_COMPLETE', `[Local] Finished URL: ${url}. Success: ${success}. Facts: ${facts.length}`, { url, success, factsCount: facts.length });

                    // Queue new links
                    const cleanLinks = extractAndNormalizeLinks(url, discoveredLinks, queryKeywords);
                    for (const link of cleanLinks) {
                        if (!visitedUrls.has(link)) {
                            visitedUrls.add(link);
                            nextLevelUrls.push(link);
                        }
                    }

                } catch (err: any) {
                    logger.error(`Error processing URL ${url}: ${err.message}`);
                } finally {
                    semaphore.release();
                }
            });

            await Promise.all(levelPromises);
            // Limit next depth URLs to top 10 relevant links to prevent queue explosion
            activeLevelUrls = nextLevelUrls.slice(0, 10);
            currentDepth++;
        }

        if (allSourceResults.length === 0) {
            logger.agentActivity(parentMissionId, 'SWARM_WARN', `Swarm finished but could not extract any valid facts for objective: "${input.objective}"`);
            return {
                status: OPERATION_STATUS.WARNING,
                summary: `Swarm finished but could not extract any valid facts for objective: "${input.objective}"`,
                data: { results: [] }
            };
        }

        // ==========================================
        // FAN-IN REPORT SYNTHESIS (HIGH COGNITIVE)
        // ==========================================
        logger.agentActivity(parentMissionId, 'SWARM_SYNTHESIS_START', `Synthesizing final research report from ${allSourceResults.length} sources...`, { sourcesCount: allSourceResults.length });
        await config?.onPacket?.({
            type: 'reasoning',
            content: `\n[Swarm Synthesis] Synthesizing final research report from ${allSourceResults.length} sources...`
        });

        const synthesisPrompt = generateSynthesisPrompt(input.query, input.objective, allSourceResults);
        const finalReport = await withTimeout(
            callLLM(
                provider, 
                "You are a master research synthesizer. Write a comprehensive report.", 
                synthesisPrompt
            ),
            60000,
            "Final report synthesis timed out after 60s"
        );

        logger.agentActivity(parentMissionId, 'SWARM_COMPLETE', `Swarm research completed successfully for query: "${input.query}"`, {
            sourcesCount: allSourceResults.length,
            factsCount: allSourceResults.reduce((acc, r) => acc + r.facts.length, 0)
        });

        return {
            status: OPERATION_STATUS.SUCCESS,
            summary: finalReport,
            data: { results: allSourceResults }
        };

    }
};

export default deep_web_research;
