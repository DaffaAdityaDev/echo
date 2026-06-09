import { ToolDefinition } from '../../../shared/types';

export class ToolRetriever {
    private tools: ToolDefinition[];

    constructor(tools: ToolDefinition[]) {
        this.tools = tools;
    }

    public updateIndex(tools: ToolDefinition[]) {
        this.tools = tools;
    }

    /**
     * Mengembalikan daftar tool yang paling relevan dengan prompt user
     */
    public getRelevantTools(userPrompt: string, allTools: ToolDefinition[], limit = 4): ToolDefinition[] {
        const query = userPrompt.toLowerCase();
        
        const scored = allTools.map(tool => {
            let score = 0;
            
            // 1. Keyword matching (weight: 0.6)
            if (tool.keywords) {
                for (const keyword of tool.keywords) {
                    if (query.includes(keyword.toLowerCase())) {
                        score += 0.6;
                    }
                }
            }

            // 2. Description matching (weight: 0.3)
            const descLower = tool.description.toLowerCase();
            if (query.includes(descLower) || descLower.includes(query)) {
                score += 0.3;
            }

            // 3. Name matching (weight: 0.1)
            const nameLower = tool.name.toLowerCase();
            if (query.includes(nameLower) || nameLower.includes(query)) {
                score += 0.1;
            }

            return { tool, score };
        });

        // Filter yang score-nya > 0 lalu urutkan menurun
        const matched = scored
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.tool);

        if (matched.length === 0) {
            // Fallback: Jika tidak ada yang cocok sama sekali, berikan core tools bawaan
            const fallbackNames = ['web_search', 'list_files'];
            return allTools.filter(t => fallbackNames.includes(t.name));
        }

        return matched.slice(0, limit);
    }
}
