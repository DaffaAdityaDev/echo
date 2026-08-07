"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_STANDARD } from "@/lib/query-standard";
import { featuresApi } from "../services/features-api";
import type { AgentFeature } from "../types";

export function useFeatures() {
  const query = useQuery<AgentFeature[]>({
    queryKey: ["features"],
    queryFn: featuresApi.list,
    ...QUERY_STANDARD,
    staleTime: 5 * 60_000,
  });

  return {
    features: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
