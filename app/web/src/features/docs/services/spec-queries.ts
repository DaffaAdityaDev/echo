import { QUERY_KEYS } from "@/constants";
import { normalizeSpec, type RawSwaggerDoc } from "@/features/docs/lib/normalize";
import type { NormalizedSpec } from "@/features/docs/lib/types";
import { QUERY_STANDARD } from "@/lib/query-standard";

export const specQueries = {
  all: QUERY_KEYS.DOCS.SPEC,
  fetch: () => ({
    queryKey: specQueries.all,
    queryFn: async (): Promise<NormalizedSpec> => {
      const res = await fetch("/api/docs/spec", { cache: "no-store" });

      if (!res.ok) throw new Error(`Failed to load spec: ${res.statusText}`);

      // SAFETY: Fetching Swagger JSON spec from internal api route and passing to normalizer
      const data = (await res.json()) as RawSwaggerDoc;

      return normalizeSpec(data);
    },
    ...QUERY_STANDARD,
    staleTime: 5 * 60_000,
  }),
};
