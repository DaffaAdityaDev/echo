import { Context } from "hono";
import { logger } from "../../../shared/utils/logger";
import { LLM_API_VERSIONS } from "../../../shared/constants";
import { ENV } from "../../../config/env";
import { MODEL_CONSTANTS, LOG_MESSAGES } from "./model.constants";

export class ModelController {
  public async listModels(c: Context) {
    const baseHost = ENV.LLM_MODEL_API_URL;
    const host = baseHost.replace(/\/$/, '');
    const url = `${host}${LLM_API_VERSIONS.V1}${MODEL_CONSTANTS.MODELS_PATH}`;

    try {
      logger.info(LOG_MESSAGES.FETCHING_MODELS, { url });
      const response = await fetch(url);
      const result = await response.json() as any;
      
      // Transform OpenAI/LM Studio format { data: [...] } to our internal { models: [...] }
      const models = (result.data || []).map((m: any) => ({
          id: m.id,
          name: m.id.split('/').pop() || m.id 
      }));

      return c.json({ models });
    } catch (error: any) {
      logger.error(LOG_MESSAGES.FETCH_FAILED, error);
      return c.json({ models: [] });
    }
  }
}

export const modelController = new ModelController();
