"use client";

import { useQuery } from "@tanstack/react-query";
import { modelQueries } from "@/lib/queries";

const EMPTY_MODELS: any[] = [];

export function useModels() {
  const query = useQuery(modelQueries.list());
  return {
    ...query,
    models: query.data?.models || EMPTY_MODELS,
  };
}
