import { z } from 'zod';
import { ToolDefinition, Observation, LLMProvider } from '../../../../../shared/types';
import { logger } from '../../../../../shared/utils/logger';
import { HumanMessage } from '@langchain/core/messages';
import { AgentHarness } from '../../../harness';
import { AnchorFactory } from '../../../anchors/factory';
import { 
    HTTP_HEADERS, 
    RESEARCH_DEFAULTS, 
    DEEP_RESEARCH_CONFIG, 
    SCHEMA_DESC, 
    OPERATION_STATUS, 
    DUCKDUCKGO_CONFIG, 
    PARSE_PATTERNS, 
    RESEARCH_LOGS, 
    RESEARCH_TEMPLATES 
} from './constants';
import { generateCrawlerSystemTemplate } from './prompts';

interface DuckDuckGoResult {
    title: string;
    url: string;
    snippet: string;
}

async function searchDuckDuckGo(query: string): Promise<DuckDuckGoResult[]> {
    const encoded = encodeURIComponent(query);
    const url = DUCKDUCKGO_CONFIG.BASE_URL(encoded);

    const response = await fetch(url, {
        headers: {
            [HTTP_HEADERS.USER_AGENT_KEY]: HTTP_HEADERS.USER_AGENT_VALUE,
            [HTTP_HEADERS.ACCEPT_KEY]: HTTP_HEADERS.ACCEPT_VALUE,
        }
    });

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
        try {
            const provider = config?.provider;
            if (!provider) {
                throw new Error("LLMProvider is required for deep web research");
            }

            logger.info(RESEARCH_LOGS.START(input.query, input.objective));

            const results = await searchDuckDuckGo(input.query);
            if (results.length === 0) {
                return {
                    status: OPERATION_STATUS.WARNING,
                    summary: RESEARCH_LOGS.NO_RESULTS(input.query),
                    data: { results: [] }
                };
            }

            // Limit targets
            const targets = results.slice(0, RESEARCH_DEFAULTS.MAX_TARGETS);
            logger.info(RESEARCH_LOGS.TARGETS(results.length, targets.length));

            // Execute crawler sub-agents concurrently
            const crawlerPromises = targets.map(async (target, idx) => {
                const agentName = RESEARCH_LOGS.CRAWLER_AGENT_NAME(idx + 1);
                logger.info(RESEARCH_LOGS.SPAWNING(agentName, target.url));

                const systemPrompt = generateCrawlerSystemTemplate(target.url, input.objective);

                const subagentStrategy = {
                    name: RESEARCH_DEFAULTS.CRAWLER_STRATEGY_NAME,
                    buildSystemPrompt: () => systemPrompt
                };

                const childMissionId = crypto.randomUUID();
                const childHarness = new AgentHarness({
                    provider,
                    strategy: subagentStrategy,
                    missionId: childMissionId,
                    tenantId: RESEARCH_DEFAULTS.TENANT_ID
                });

                const childState = {
                    missionId: childMissionId,
                    objective: RESEARCH_LOGS.CRAWLER_OBJECTIVE(target.url, input.objective),
                    tasks: [],
                    memory: {},
                    messages: [
                        AnchorFactory.create().build(),
                        new HumanMessage(RESEARCH_LOGS.CRAWLER_HUMAN_MESSAGE(target.url, input.objective))
                    ]
                };

                let subAgentOutput = "";
                await childHarness.runMission(
                    childState,
                    async (packet: any) => {
                        if (packet.type === RESEARCH_DEFAULTS.PACKET_CONTENT_TYPE && packet.content) {
                            subAgentOutput += packet.content;
                        }
                        // Relay sub-agent streaming packets to parent stream callback to prevent freeze
                        if (config?.onPacket) {
                            await config.onPacket(packet);
                        }
                    }
                );

                return {
                    title: target.title,
                    url: target.url,
                    content: subAgentOutput || RESEARCH_DEFAULTS.EMPTY_RESULT_FALLBACK
                };
            });

            const scrapedResults = await Promise.all(crawlerPromises);

            // Synthesize results
            let summaryMarkdown = RESEARCH_TEMPLATES.SYNTHESIS_HEADER;
            summaryMarkdown += RESEARCH_TEMPLATES.QUERY(input.query);
            summaryMarkdown += RESEARCH_TEMPLATES.OBJECTIVE(input.objective);

            summaryMarkdown += RESEARCH_TEMPLATES.SOURCE_OVERVIEW;
            scrapedResults.forEach((res, i) => {
                summaryMarkdown += RESEARCH_TEMPLATES.SOURCE_LINE(i + 1, res.title, res.url);
            });
            summaryMarkdown += RESEARCH_TEMPLATES.SEPARATOR;

            scrapedResults.forEach((res, i) => {
                summaryMarkdown += RESEARCH_TEMPLATES.SOURCE_DETAIL_HEADER(i + 1, res.title);
                summaryMarkdown += RESEARCH_TEMPLATES.SOURCE_URL(res.url);
                summaryMarkdown += `${res.content.trim()}\n\n`;
                summaryMarkdown += RESEARCH_TEMPLATES.SEPARATOR;
            });

            return {
                status: OPERATION_STATUS.SUCCESS,
                summary: summaryMarkdown,
                data: { results: scrapedResults }
            };

        } catch (error: any) {
            logger.error(RESEARCH_LOGS.FAIL, error);
            return {
                status: OPERATION_STATUS.ERROR,
                summary: RESEARCH_TEMPLATES.FAIL_SUMMARY(error.message),
                error: error.message
            };
        }
    }
};

export default deep_web_research;
