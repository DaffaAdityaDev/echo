"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface AgentFeature {
  id: string;
  name: string;
  description: string;
  locked: boolean;
}

export function useFeatures() {
  const query = useQuery<AgentFeature[]>({
    queryKey: ["features"],
    queryFn: async () => {
      const data = await api.get<AgentFeature[] | { features: AgentFeature[] }>("/features");
      if (Array.isArray(data)) return data;
      return data.features ?? [];
    },
  });

  return {
    features: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
