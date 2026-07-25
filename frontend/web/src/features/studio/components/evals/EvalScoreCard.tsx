"use client"

import React from "react"
import { cn } from "@/utils/cn"
import type { EvalRun } from "../../types"

interface EvalScoreCardProps {
  evalRun: EvalRun | null
  isLoading: boolean
}

function ScoreBar({ label, score, max = 100, color }: { label: string; score: number; max?: number; color: string }) {
  const pct = Math.round((score / max) * 100)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className={cn("font-semibold", color)}>{score}/{max}</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", color.replace("text-", "bg-"))} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function EvalScoreCard({ evalRun, isLoading }: EvalScoreCardProps) {
  if (isLoading) {
    return (
      <div className="border border-zinc-800/60 bg-zinc-900/20 rounded-2xl p-5 space-y-4">
        <div className="h-5 w-32 bg-zinc-800 rounded animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (!evalRun) return null

  const totalScore = Math.round((evalRun.score_accuracy + evalRun.score_format + evalRun.score_tools) / 3)
  const failedCases = evalRun.details.filter(d => !d.passed)

  return (
    <div className="border border-zinc-800/60 bg-zinc-900/20 rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Eval Results</h3>
          <p className="text-xs text-zinc-500">{evalRun.executed_by} · {new Date(evalRun.created_at).toLocaleString()}</p>
        </div>
        <div className="text-center">
          <div className={cn(
            "text-3xl font-bold",
            evalRun.pass_rate >= 80 ? "text-emerald-400" : evalRun.pass_rate >= 50 ? "text-amber-400" : "text-red-400"
          )}>
            {evalRun.pass_rate}%
          </div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Pass Rate</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ScoreBar label="Accuracy" score={evalRun.score_accuracy} color="text-blue-400" />
        <ScoreBar label="Format Compliance" score={evalRun.score_format} color="text-emerald-400" />
        <ScoreBar label="Tool Correctness" score={evalRun.score_tools} color="text-purple-400" />
      </div>

      {failedCases.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-zinc-400">Failed Cases ({failedCases.length})</h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {failedCases.slice(0, 10).map((d, idx) => (
              <div key={idx} className="text-xs text-zinc-400 bg-zinc-800/40 rounded-lg px-3 py-2 flex items-start gap-2">
                <span className="text-red-400 shrink-0 mt-0.5">•</span>
                <div className="min-w-0">
                  <div className="truncate text-zinc-300">{d.input as string}</div>
                  <div className="text-zinc-500 truncate">Expected: {d.expected_output as string}</div>
                </div>
              </div>
            ))}
            {failedCases.length > 10 && (
              <div className="text-xs text-zinc-500 text-center pt-1">...and {failedCases.length - 10} more</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
