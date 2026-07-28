import { ENDPOINTS, QUERY_KEYS } from "@/constants";
import { api } from "@/lib/api-client";

export interface Model {
  id: string;
  name: string;
  provider_type: string;
  provider_name: string;
  supports_multimodal?: boolean;
}

export const modelQueries = {
  all: QUERY_KEYS.MODELS.ALL,
  list: () => ({
    queryKey: modelQueries.all,
    queryFn: async () => {
      // The new api-client returns the body directly, no need for { data } destructuring
      return api.get<{ models: Model[] }>(ENDPOINTS.MODELS.LIST);
    },
  }),
};
