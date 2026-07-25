"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { STUDIO_ENDPOINTS, STUDIO_QUERY_KEYS } from "../constants"
import type { EvalDataset, EvalRun, TestCase } from "../types"

export function useCreateDataset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; description: string; test_cases: TestCase[] }) =>
      api.post<EvalDataset>(STUDIO_ENDPOINTS.EVAL_DATASETS, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.EVAL_RUNS }),
  })
}

export function useRunEval() {
  return useMutation({
    mutationFn: (body: { prompt_version_id: string; dataset_id: string }) =>
      api.post<EvalRun>(STUDIO_ENDPOINTS.EVAL_RUN, body),
  })
}

export function useEvalRun(runId: string | null) {
  return useQuery<EvalRun>({
    queryKey: runId ? ['studio', 'evals', 'runs', runId] : ['studio', 'evals', 'runs', 'none'],
    queryFn: () => api.get(STUDIO_ENDPOINTS.EVAL_RESULT(runId!)),
    enabled: !!runId,
  })
}
