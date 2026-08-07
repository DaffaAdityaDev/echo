"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_STANDARD } from "@/lib/query-standard";
import { skillsApi } from "../services/skills-api";
import type { AgentSkill } from "../types";

export function useSkills() {
  const query = useQuery<AgentSkill[]>({
    queryKey: ["skills"],
    queryFn: skillsApi.list,
    ...QUERY_STANDARD,
    staleTime: 5 * 60_000,
  });

  return {
    skills: query.data || [],
    isLoading: query.isLoading,
  };
}
