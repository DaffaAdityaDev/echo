"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useCatalogStore } from "@/features/shared/stores/catalogStore";
import type { Model } from "@/lib/queries";
import { modelQueries } from "@/lib/queries";

const EMPTY_MODELS: Model[] = [];

export function useModels() {
  const query = useQuery(modelQueries.list());
  const setModels = useCatalogStore((s) => s.setModels);

  useEffect(() => {
    if (query.data) setModels(query.data.models);
  }, [query.data, setModels]);

  return {
    ...query,
    models: query.data?.models || EMPTY_MODELS,
  };
}
