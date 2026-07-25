"use client"

import { useAuditTrail, AuditTrailTable } from "@/features/studio"

export default function AuditRoute() {
  const props = useAuditTrail()
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Audit Trail</h1>
        <p className="text-sm text-zinc-400 mt-1">Every governance action recorded — version promotions, rollbacks, and approvals.</p>
      </div>
      <AuditTrailTable auditLogs={props.auditLogs} isLoading={props.isLoading} />
    </div>
  )
}
