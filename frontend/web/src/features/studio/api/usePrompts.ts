"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { STUDIO_QUERY_KEYS } from "../constants";
import { studioApi } from "../services/studio-api";
import { useStudioStore } from "../stores/studioStore";
import type { PromptTemplate, PromptVersion } from "../types";

export function usePromptTemplates() {
  const setPrompts = useStudioStore((s) => s.setPrompts);
  const query = useQuery<{ templates: PromptTemplate[] }>({
    queryKey: STUDIO_QUERY_KEYS.PROMPTS,
    queryFn: studioApi.listPrompts,
  });

  useEffect(() => {
    if (query.data) {
      setPrompts(query.data.templates);
    }
  }, [query.data, setPrompts]);

  return query;
}

export function usePromptVersions(templateId: string | null) {
  return useQuery<{ versions: PromptVersion[] }>({
    queryKey: templateId ? STUDIO_QUERY_KEYS.PROMPT_VERSIONS(templateId) : ["studio", "prompts", "none"],
    queryFn: () => {
      if (!templateId) {
        throw new Error("templateId is required");
      }
      return studioApi.listPromptVersions(templateId);
    },
    enabled: !!templateId,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: studioApi.createPrompt,
    onSuccess: () => qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.PROMPTS }),
  });
}

export function useCreateVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { system_prompt: string; bound_tools: string[]; variables: string[] };
    }) => studioApi.createPromptVersion(id, body),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.PROMPT_VERSIONS(vars.id) }),
  });
}

export function usePromoteVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => studioApi.promotePromptVersion(id, version),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.PROMPT_VERSIONS(vars.id) });
      qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.PROMPTS });
    },
  });
}

export function useRollbackVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => studioApi.rollbackPromptVersion(id, version),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.PROMPT_VERSIONS(vars.id) });
      qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.PROMPTS });
    },
  });
}
