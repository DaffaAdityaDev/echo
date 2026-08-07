import { QUERY_KEYS } from "@/constants";
import { modelsApi } from "@/features/chat/services/models-api";
import { QUERY_STANDARD } from "@/lib/query-standard";

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
    queryFn: () => modelsApi.list(),
    ...QUERY_STANDARD,
    staleTime: 5 * 60_000,
  }),
};
