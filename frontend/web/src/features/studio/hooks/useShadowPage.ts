"use client"

import { useState, useMemo } from "react"
import { usePromptTemplates } from "../api/usePrompts"
import { useShadowHistory } from "../api/useShadow"

export function useShadowPage() {
  const templatesQuery = usePromptTemplates()
  const templates = templatesQuery.data?.templates ?? []
  const [userSelectedId, setUserSelectedId] = useState<string | null>(null)

  const effectiveTemplateId = useMemo(() => {
    return userSelectedId ?? templates[0]?.id ?? null
  }, [userSelectedId, templates])

  const shadowQuery = useShadowHistory(effectiveTemplateId)
  const shadowRuns = shadowQuery.data?.shadow_runs ?? []

  return {
    templates,
    effectiveTemplateId,
    shadowRuns,
    isLoading: shadowQuery.isLoading,
    onSelectTemplate: setUserSelectedId,
  }
}