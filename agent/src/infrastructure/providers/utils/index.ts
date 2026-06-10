import { LOCAL_URL_KEYWORDS, PRICING_MODELS } from "../constants";

export function calculateUsageCost(
    modelName: string,
    baseURL: string,
    promptTokens: number,
    completionTokens: number,
    cachedTokens: number
): { stepCost: number; cacheRatio: number } {
    const lowerURL = baseURL.toLowerCase();
    const cacheRatio = promptTokens > 0 ? (cachedTokens / promptTokens) : 0;
    
    if (LOCAL_URL_KEYWORDS.some(kw => lowerURL.includes(kw))) {
        return { stepCost: 0, cacheRatio };
    }

    const model = modelName.toLowerCase();
    let inputRate: number = PRICING_MODELS.DEFAULT.inputRate;
    let outputRate: number = PRICING_MODELS.DEFAULT.outputRate;
    let cacheReadRate: number = PRICING_MODELS.DEFAULT.cacheReadRate;

    if (model.includes(PRICING_MODELS.GPT_4O_MINI.pattern)) {
        inputRate = PRICING_MODELS.GPT_4O_MINI.inputRate;
        outputRate = PRICING_MODELS.GPT_4O_MINI.outputRate;
        cacheReadRate = PRICING_MODELS.GPT_4O_MINI.cacheReadRate;
    } else if (model.includes(PRICING_MODELS.GPT_4O.pattern)) {
        inputRate = PRICING_MODELS.GPT_4O.inputRate;
        outputRate = PRICING_MODELS.GPT_4O.outputRate;
        cacheReadRate = PRICING_MODELS.GPT_4O.cacheReadRate;
    } else if (model.includes(PRICING_MODELS.CLAUDE_3_5_SONNET.pattern)) {
        inputRate = PRICING_MODELS.CLAUDE_3_5_SONNET.inputRate;
        outputRate = PRICING_MODELS.CLAUDE_3_5_SONNET.outputRate;
        cacheReadRate = PRICING_MODELS.CLAUDE_3_5_SONNET.cacheReadRate;
    }

    const nonCached = Math.max(0, promptTokens - cachedTokens);
    const stepCost = ((nonCached * inputRate) + (cachedTokens * cacheReadRate) + (completionTokens * outputRate)) / 1000000;

    return { stepCost, cacheRatio };
}
