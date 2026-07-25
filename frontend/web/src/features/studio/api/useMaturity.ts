"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { studioApi } from "../services/studio-api"
import { STUDIO_QUERY_KEYS } from "../constants"
import type { ClientCompanyAssessment } from "../types"

export function useMaturityAssessment() {
  return useQuery({
    queryKey: STUDIO_QUERY_KEYS.MATURITY,
    queryFn: () => studioApi.getMaturityAssessment(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useSaveClientAssessment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (assessment: ClientCompanyAssessment) =>
      studioApi.saveClientAssessment(assessment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.MATURITY })
    },
  })
}
