"use client"

import React, { useState } from "react"
import { ShieldAlert, ChevronDown, ChevronRight, Search } from "lucide-react"
import { EmptyState } from "../shared/EmptyState"
import { JsonViewer } from "../shared/JsonViewer"
import type { AuditLog } from "../../types"

interface AuditTrailTableProps {
  auditLogs: AuditLog[]
  isLoading: boolean
}

const ACTION_COLORS: Record<string, string> = {
  CREATE_TEMPLATE: "text-blue-600",
  CREATE_VERSION: "text-blue-600",
  PROMOTE_VERSION: "text-emerald-600",
  ROLLBACK: "text-amber-600",
  APPROVE: "text-emerald-600",
  REJECT: "text-red-600",
}

export function AuditTrailTable({ auditLogs, isLoading }: AuditTrailTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const filtered = auditLogs.filter(
    (l) =>
      l.actor.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.resource.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-zinc-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search audit logs..."
          className="w-full h-9 pl-9 pr-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
        />
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title={search ? "No logs match your search" : "No audit logs yet"}
          description="Governance actions will appear here as you create, promote, and rollback prompt versions."
          action={null}
        />
      ) : (
        <div className="border border-zinc-200 bg-zinc-50/50 rounded-2xl overflow-hidden divide-y divide-zinc-200">
          {filtered.map((log) => {
            const isExpanded = expandedId === log.id
            const color = ACTION_COLORS[log.action] || "text-zinc-700"

            return (
              <div key={log.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-100/60 transition-colors text-left"
                >
                  <div className="shrink-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                  </div>
                  <div className="p-1.5 rounded-lg bg-zinc-200 text-zinc-600 shrink-0">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${color}`}>{log.action}</span>
                      <span className="text-xs text-zinc-600">{log.actor}</span>
                    </div>
                    <div className="text-xs text-zinc-600 truncate">{log.resource}</div>
                  </div>
                  <div className="text-[10px] text-zinc-600 shrink-0">{new Date(log.created_at).toLocaleString()}</div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4">
                    <JsonViewer data={log.payload} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
