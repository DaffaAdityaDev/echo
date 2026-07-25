"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { STUDIO_ENDPOINTS, STUDIO_QUERY_KEYS } from "../constants"
import type { ShadowRun } from "../types"

export function useShadowHistory(templateId: string | null, limit = 20) {
  return useQuery<{ shadow_runs: ShadowRun[] }>({
    queryKey: templateId ? [...STUDIO_QUERY_KEYS.SHADOW, templateId] : STUDIO_QUERY_KEYS.SHADOW,
    queryFn: () => api.get(`${STUDIO_ENDPOINTS.SHADOW_HISTORY(templateId!)}?limit=${limit}`),
    enabled: !!templateId,
  })
}
