import type { Context } from "hono";
import { ENV } from "../../../../config/env";
import { LLM_API_VERSIONS } from "../../../../shared/constants";
import { logger } from "../../../../shared/utils/logger";
import { LOG_MESSAGES, MODEL_CONSTANTS } from "./model.constants";
import type { ModelsResponse } from "./model.schema";

export async function listModels(c: Context) {
  const baseHost = ENV.LLM_MODEL_API_URL;
  const host = baseHost.replace(/\/$/, "");
  const url = `${host}${LLM_API_VERSIONS.V1}${MODEL_CONSTANTS.MODELS_PATH}`;

  try {
    logger.info(LOG_MESSAGES.FETCHING_MODELS, { url });
    const response = await fetch(url);
    const result = (await response.json()) as { data?: Array<{ id: string }> };

    const models: ModelsResponse = {
      models: (result.data || []).map((m) => ({
        id: m.id,
        name: m.id.split("/").pop() || m.id,
      })),
    };

    return c.json(models);
  } catch (error: unknown) {
    logger.error(LOG_MESSAGES.FETCH_FAILED, error);
    return c.json({ models: [] });
  }
}
