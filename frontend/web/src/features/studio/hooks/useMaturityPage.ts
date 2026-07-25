"use client"

import { useMaturityModel } from "./useMaturityModel"
import { useMaturityAssessment, useSaveClientAssessment } from "../api/useMaturity"

export function useMaturityPage() {
  const model = useMaturityModel()
  const assessmentQuery = useMaturityAssessment()
  const saveAssessment = useSaveClientAssessment()

  const handleSaveClient = async () => {
    await saveAssessment.mutateAsync(model.clientAssessment)
  }

  return {
    ...model,
    serverAssessment: assessmentQuery.data ?? null,
    isSaving: saveAssessment.isPending,
    onSaveClient: handleSaveClient,
  }
}