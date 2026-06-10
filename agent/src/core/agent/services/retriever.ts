import { ToolDefinition } from '../../../shared/types';
import { RETRIEVER_CONFIG, MATCH_WEIGHTS, RETRIEVER_FALLBACK_TOOLS } from './retriever.constants';

export class ToolRetriever {
    private tools: ToolDefinition[];

    constructor(tools: ToolDefinition[]) {
        this.tools = tools;
    }

    public updateIndex(tools: ToolDefinition[]) {
        this.tools = tools;
    }

    /**
     * Returns a list of tools most relevant to the user prompt.
     */
    public getRelevantTools(
        userPrompt: string, 
        allTools: ToolDefinition[], 
        limit = RETRIEVER_CONFIG.DEFAULT_LIMIT
    ): ToolDefinition[] {
        const query = userPrompt.toLowerCase();
        
        const scored = allTools.map(tool => {
            let score = 0;
            
            // 1. Keyword matching (weight based on MATCH_WEIGHTS.KEYWORD)
            if (tool.keywords) {
                for (const keyword of tool.keywords) {
                    if (query.includes(keyword.toLowerCase())) {
                        score += MATCH_WEIGHTS.KEYWORD;
                    }
                }
            }

            // 2. Description matching (weight based on MATCH_WEIGHTS.DESCRIPTION)
            const descLower = tool.description.toLowerCase();
            if (query.includes(descLower) || descLower.includes(query)) {
                score += MATCH_WEIGHTS.DESCRIPTION;
            }

            // 3. Name matching (weight based on MATCH_WEIGHTS.NAME)
            const nameLower = tool.name.toLowerCase();
            if (query.includes(nameLower) || nameLower.includes(query)) {
                score += MATCH_WEIGHTS.NAME;
            }

            return { tool, score };
        });

        // Filter out matches with a score above the minimum, then sort descending
        const matched = scored
            .filter(item => item.score > RETRIEVER_CONFIG.MIN_MATCH_SCORE)
            .sort((a, b) => b.score - a.score)
            .map(item => item.tool);

        if (matched.length === 0) {
            // Fallback: If no tools match, return default core tools
            return allTools.filter(t => (RETRIEVER_FALLBACK_TOOLS as readonly string[]).includes(t.name));
        }

        return matched.slice(0, limit);
    }
}
