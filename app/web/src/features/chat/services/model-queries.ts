import { QUERY_KEYS } from "@/constants";
import { QUERY_STANDARD } from "@/lib/query-standard";
import { modelsApi } from "./models-api";

export const modelQueries = {
  all: QUERY_KEYS.MODELS.ALL,
  list: () => ({
    queryKey: modelQueries.all,
    queryFn: () => modelsApi.list(),
    ...QUERY_STANDARD,
    staleTime: 5 * 60_000,
  }),
};
