import { Hono } from "hono";
import { logger } from "../../shared/utils/logger";
import { LLM_API_VERSIONS } from "../../shared/constants";

const router = new Hono();

router.get("/models", async (c) => {
    const baseHost = process.env.LLM_MODEL_API_URL || "http://localhost:1234";
    const host = baseHost.replace(/\/$/, '');
    const url = `${host}${LLM_API_VERSIONS.V1}/models`;

    try {
        logger.info(`Fetching models from provider`, { url });
        const response = await fetch(url);
        const result = await response.json() as any;
        
        // Transform OpenAI/LM Studio format { data: [...] } to our internal { models: [...] }
        const models = (result.data || []).map((m: any) => ({
            id: m.id,
            name: m.id.split('/').pop() || m.id 
        }));

        return c.json({ models });
    } catch (error) {
        logger.error("Failed to fetch models", error);
        return c.json({ models: [] });
    }
});

export default router;
