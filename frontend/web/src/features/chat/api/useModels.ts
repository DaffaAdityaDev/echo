"use client";

import { useQuery } from "@tanstack/react-query";
import { modelQueries } from "@/lib/queries";

export function useModels() {
  const query = useQuery(modelQueries.list());
  return {
    ...query,
    models: query.data?.models || [],
  };
}
