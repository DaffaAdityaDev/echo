"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface AgentSkill {
  name: string;
  description: string;
  preferredTools: string[];
  modifiers: Record<string, unknown>;
}

export function useSkills() {
  const query = useQuery<AgentSkill[]>({
    queryKey: ["skills"],
    queryFn: () => api.get<AgentSkill[]>("/skills"),
  });

  return {
    skills: query.data || [],
    isLoading: query.isLoading,
  };
}
