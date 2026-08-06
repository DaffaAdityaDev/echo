import { ENDPOINTS } from "@/constants";
import { api } from "@/lib/api-client";
import type { Model } from "@/lib/queries";

export const modelsApi = {
  list: async (): Promise<{ models: Model[] }> => {
    return api.get<{ models: Model[] }>(ENDPOINTS.MODELS.LIST);
  },
};
