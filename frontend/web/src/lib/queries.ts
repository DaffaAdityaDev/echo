import { QUERY_KEYS } from "@/constants";
import { modelsApi } from "@/features/chat/services/models-api";
import { normalizeSpec } from "@/lib/docs/normalize";
import type { NormalizedSpec } from "@/lib/docs/types";
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

export const specQueries = {
  all: QUERY_KEYS.DOCS.SPEC,
  fetch: () => ({
    queryKey: specQueries.all,
    queryFn: async (): Promise<NormalizedSpec> => {
      const res = await fetch("/api/docs/spec", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load spec: ${res.statusText}`);
      return normalizeSpec((await res.json()) as Record<string, unknown>);
    },
    ...QUERY_STANDARD,
    staleTime: 5 * 60_000,
  }),
};
