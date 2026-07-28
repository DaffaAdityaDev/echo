"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { STUDIO_ENDPOINTS, STUDIO_QUERY_KEYS } from "../constants";
import type { PromptTemplate, PromptVersion } from "../types";

export function usePromptTemplates() {
  return useQuery<{ templates: PromptTemplate[] }>({
    queryKey: STUDIO_QUERY_KEYS.PROMPTS,
    queryFn: () => api.get(STUDIO_ENDPOINTS.PROMPTS),
  });
}

export function usePromptVersions(templateId: string | null) {
  return useQuery<{ versions: PromptVersion[] }>({
    queryKey: templateId ? STUDIO_QUERY_KEYS.PROMPT_VERSIONS(templateId) : ["studio", "prompts", "none"],
    queryFn: () => api.get(STUDIO_ENDPOINTS.PROMPT_VERSIONS(templateId!)),
    enabled: !!templateId,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description: string }) =>
      api.post<PromptTemplate>(STUDIO_ENDPOINTS.PROMPTS, body),
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
    }) => api.post<PromptVersion>(STUDIO_ENDPOINTS.PROMPT_VERSIONS(id), body),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.PROMPT_VERSIONS(vars.id) }),
  });
}

export function usePromoteVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.post(STUDIO_ENDPOINTS.PROMPT_PROMOTE(id, version), {}),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.PROMPT_VERSIONS(vars.id) });
      qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.PROMPTS });
    },
  });
}

export function useRollbackVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.post(STUDIO_ENDPOINTS.PROMPT_ROLLBACK(id, version), {}),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.PROMPT_VERSIONS(vars.id) });
      qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.PROMPTS });
    },
  });
}
