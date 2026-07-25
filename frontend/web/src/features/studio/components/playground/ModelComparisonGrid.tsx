"use client"

import React from "react"
import { cn } from "@/utils/cn"
import type { PlaygroundResult } from "../../types"

interface ModelComparisonGridProps {
  results: PlaygroundResult[]
  isLoading: boolean
}

export function ModelComparisonGrid({ results, isLoading }: ModelComparisonGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-zinc-800/60 bg-zinc-900/20 rounded-2xl p-4 space-y-3">
            <div className="h-5 w-24 bg-zinc-800 rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 bg-zinc-800 rounded animate-pulse" />
              <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-zinc-800 rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!results || results.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {results.map((r, idx) => (
        <div
          key={idx}
          className={cn(
            "border rounded-2xl p-4 space-y-3 transition-all",
            r.error
              ? "border-red-500/20 bg-red-500/5"
              : "border-zinc-800/60 bg-zinc-900/20"
          )}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">{r.model}</h3>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              {r.latency_ms > 0 && <span>{r.latency_ms}ms</span>}
              {r.tokens > 0 && <span>{r.tokens} tok</span>}
            </div>
          </div>
          {r.error ? (
            <div className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{r.error}</div>
          ) : (
            <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
              {r.content}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}
