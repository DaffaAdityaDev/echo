"use client";

import { useQuery } from "@tanstack/react-query";
import type { Model } from "../types";
import { modelQueries } from "../services/model-queries";

const EMPTY_MODELS: Model[] = [];

export function useModels() {
  const query = useQuery(modelQueries.list());

  return {
    ...query,
    models: query.data?.models || EMPTY_MODELS,
  };
}
