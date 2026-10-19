import type { Context } from "hono";
import { ENV } from "../../../../config/env";
import { LLM_API_VERSIONS } from "../../../../shared/constants";
import { toLogCause } from "../../../../shared/utils/errors";
import { logger } from "../../../../shared/utils/logger";
import { LOG_MESSAGES, MODEL_CONSTANTS } from "./model.constants";
import type { ModelsResponse } from "./model.schema";

interface ProviderModelsApiResponse {
  data?: Array<{ id: string }>;
}

// LLM_MODEL_API_URL may be configured with or without the /v1 suffix (compose sets ".../v1").
function buildModelsUrl(baseUrl: string): string {
  const host = baseUrl.replace(/\/+$/, "");
  const versionedHost = host.endsWith(LLM_API_VERSIONS.V1) ? host : `${host}${LLM_API_VERSIONS.V1}`;

  return `${versionedHost}${MODEL_CONSTANTS.MODELS_PATH}`;
}

export async function listModels(c: Context) {
  const url = buildModelsUrl(ENV.LLM_MODEL_API_URL);

  try {
    logger.info(LOG_MESSAGES.FETCHING_MODELS, { url });
    const response = await fetch(url);
    // SAFETY: LLM provider standard models endpoint returns { data: [{ id: string }] }
    const result = (await response.json()) as ProviderModelsApiResponse;

    const models: ModelsResponse = {
      models: (result.data || []).map((m) => ({
        id: m.id,
        name: m.id.split("/").pop() || m.id,
      })),
    };

    return c.json(models);
  } catch (error: unknown) {
    logger.error(LOG_MESSAGES.FETCH_FAILED, toLogCause(error));

    return c.json({ models: [] });
  }
}
