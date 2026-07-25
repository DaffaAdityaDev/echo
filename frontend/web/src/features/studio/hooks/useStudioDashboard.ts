"use client"

import { usePromptTemplates } from "../api/usePrompts"
import { useAuditLogs } from "../api/useAudit"
import { useShadowHistory } from "../api/useShadow"
import { useMaturityModel } from "./useMaturityModel"

export function useStudioDashboard() {
  const promptsQuery = usePromptTemplates()
  const auditQuery = useAuditLogs(5)
  const shadowQuery = useShadowHistory(null)
  const maturity = useMaturityModel()

  const promptCount = promptsQuery.data?.templates?.length ?? 0
  const auditLogCount = auditQuery.data?.audit_logs?.length ?? 0
  const shadowRunCount = shadowQuery.data?.shadow_runs?.length ?? 0

  const isLoading = promptsQuery.isLoading || auditQuery.isLoading
  const error = promptsQuery.error ?? auditQuery.error

  return {
    promptCount,
    evalRunCount: 0,
    shadowRunCount,
    auditLogCount,
    maturityLevel: maturity.echoAssessment.overallLevel,
    weakestDimension: maturity.echoAssessment.weakestDimension,
    maturityDimensions: maturity.dimensions,
    roadmapProgress: {
      completed: maturity.roadmap.filter((r) => r.status === 'completed').length,
      total: maturity.roadmap.length,
    },
    isLoading,
    error,
    onRefresh: () => {
      promptsQuery.refetch()
      auditQuery.refetch()
    },
  }
}

