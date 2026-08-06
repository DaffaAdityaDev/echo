"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { featuresApi } from "../services/features-api";
import { useCatalogStore } from "../stores/catalogStore";

export interface AgentFeature {
  id: string;
  name: string;
  description: string;
  locked: boolean;
}

export function useFeatures() {
  const setFeatures = useCatalogStore((s) => s.setFeatures);
  const query = useQuery<AgentFeature[]>({
    queryKey: ["features"],
    queryFn: featuresApi.list,
  });

  useEffect(() => {
    if (query.data) {
      setFeatures(query.data);
    }
  }, [query.data, setFeatures]);

  return {
    features: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
