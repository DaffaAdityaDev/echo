"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { QUERY_STANDARD } from "@/lib/query-standard";
import { skillsApi } from "../services/skills-api";
import { useCatalogStore } from "../stores/catalogStore";

export interface AgentSkill {
  name: string;
  description: string;
  preferredTools: string[];
  modifiers: Record<string, unknown>;
}

export function useSkills() {
  const setSkills = useCatalogStore((s) => s.setSkills);
  const query = useQuery<AgentSkill[]>({
    queryKey: ["skills"],
    queryFn: skillsApi.list,
    ...QUERY_STANDARD,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (query.data) {
      setSkills(query.data);
    }
  }, [query.data, setSkills]);

  return {
    skills: query.data || [],
    isLoading: query.isLoading,
  };
}
