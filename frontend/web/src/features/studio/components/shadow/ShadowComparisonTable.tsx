"use client"

import React from "react"
import { cn } from "@/utils/cn"
import { ChevronDown, ChevronRight, Check, X } from "lucide-react"
import type { ShadowRun } from "../../types"

interface ShadowComparisonTableProps {
  shadowRuns: ShadowRun[]
}

export function ShadowComparisonTable({ shadowRuns }: ShadowComparisonTableProps) {
  const [expanded, setExpanded] = React.useState<string | null>(null)

  return (
    <div className="border border-zinc-800/60 bg-zinc-900/20 rounded-2xl overflow-hidden divide-y divide-zinc-800/60">
      {shadowRuns.map((run) => {
        const liveBetter = run.live_cost_usd < run.shadow_cost_usd && run.live_latency_ms < run.shadow_latency_ms
        const shadowBetter = !liveBetter
        const isExpanded = expanded === run.id

        return (
          <div key={run.id}>
            <button
              onClick={() => setExpanded(isExpanded ? null : run.id)}
              className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-zinc-800/30 transition-colors text-left"
            >
              <div className="shrink-0">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-300 truncate">{run.user_query}</div>
              </div>
              <div className="flex items-center gap-3 text-xs shrink-0">
                <span className="text-zinc-500">{new Date(run.created_at).toLocaleDateString()}</span>
                <span className={cn("flex items-center gap-1", liveBetter ? "text-emerald-400" : "text-zinc-500")}>
                  {liveBetter ? <Check className="h-3 w-3" /> : null} Live {run.live_cost_usd.toFixed(4)}
                </span>
                <span className={cn("flex items-center gap-1", shadowBetter ? "text-blue-400" : "text-zinc-500")}>
                  {shadowBetter ? <Check className="h-3 w-3" /> : null} Shadow {run.shadow_cost_usd.toFixed(4)}
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-zinc-800/60 bg-zinc-950/40 rounded-xl p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Live (v{run.live_version_id.slice(0, 8)})</div>
                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">{run.live_output}</pre>
                    <div className="flex gap-3 mt-2 text-[10px] text-zinc-600">
                      <span>{run.live_latency_ms}ms</span>
                      <span>${run.live_cost_usd.toFixed(6)}</span>
                    </div>
                  </div>
                  <div className="border border-blue-500/20 bg-blue-950/20 rounded-xl p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1">Candidate (v{run.candidate_version_id.slice(0, 8)})</div>
                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">{run.shadow_output}</pre>
                    <div className="flex gap-3 mt-2 text-[10px] text-zinc-600">
                      <span>{run.shadow_latency_ms}ms</span>
                      <span>${run.shadow_cost_usd.toFixed(6)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
