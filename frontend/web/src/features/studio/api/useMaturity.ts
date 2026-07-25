"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { STUDIO_ENDPOINTS, STUDIO_QUERY_KEYS } from "../constants"
import type { ClientCompanyAssessment, SystemMaturityAssessment } from "../types"

export function useMaturityAssessment() {
  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.MATURITY,
    queryFn: () => api.get<SystemMaturityAssessment>(STUDIO_ENDPOINTS.MATURITY),
    staleTime: 1000 * 60 * 5,
  })
}

export function useSaveClientAssessment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (assessment: ClientCompanyAssessment) =>
      api.post<ClientCompanyAssessment>(STUDIO_ENDPOINTS.MATURITY_CLIENT, assessment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.MATURITY })
    },
  })
}
