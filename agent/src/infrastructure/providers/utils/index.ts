export * from "./reasoning-interceptor";
export * from "./zod-schema";
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
    const pricingMap: { pattern: string; rates: { inputRate: number; outputRate: number; cacheReadRate: number } }[] = [
        { pattern: PRICING_MODELS.GPT_4O_MINI.pattern, rates: PRICING_MODELS.GPT_4O_MINI },
        { pattern: PRICING_MODELS.GPT_4O.pattern, rates: PRICING_MODELS.GPT_4O },
        { pattern: PRICING_MODELS.CLAUDE_3_5_SONNET.pattern, rates: PRICING_MODELS.CLAUDE_3_5_SONNET },
    ];

    let { inputRate, outputRate, cacheReadRate }: { inputRate: number; outputRate: number; cacheReadRate: number } = PRICING_MODELS.DEFAULT;
    for (const { pattern, rates } of pricingMap) {
        if (model.includes(pattern)) {
            inputRate = rates.inputRate;
            outputRate = rates.outputRate;
            cacheReadRate = rates.cacheReadRate;
            break;
        }
    }

    const nonCached = Math.max(0, promptTokens - cachedTokens);
    const stepCost = ((nonCached * inputRate) + (cachedTokens * cacheReadRate) + (completionTokens * outputRate)) / 1000000;

    return { stepCost, cacheRatio };
}
