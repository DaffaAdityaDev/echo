"use client"

import { useAuditLogs } from "../api/useAudit"

export function useAuditTrail(limit = 50) {
  const query = useAuditLogs(limit)

  return {
    auditLogs: query.data?.audit_logs ?? [],
    isLoading: query.isLoading,
    error: query.error,
    onRefresh: () => query.refetch(),
  }
}
