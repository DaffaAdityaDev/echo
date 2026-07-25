"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { STUDIO_ENDPOINTS, STUDIO_QUERY_KEYS } from "../constants"
import type { AuditLog } from "../types"

export function useAuditLogs(limit = 50) {
  return useQuery<{ audit_logs: AuditLog[] }>({
    queryKey: STUDIO_QUERY_KEYS.AUDIT,
    queryFn: () => api.get(`${STUDIO_ENDPOINTS.AUDIT}?limit=${limit}`),
  })
}
