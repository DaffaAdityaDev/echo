"use client"

import React from "react"
import { cn } from "@/utils/cn"
import { Brain, DollarSign, BarChart3 } from "lucide-react"

interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  reasoningTokens?: number
  cachedTokens?: number
}

interface TokenCostMeterProps {
  cumulativeUsage: TokenUsage | null
  totalCost: number
  maxContextTokens: number
  maxIterations: number
  currentIteration: number
  isRunning: boolean
  className?: string
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

export function TokenCostMeter({
  cumulativeUsage,
  totalCost,
  maxContextTokens,
  maxIterations,
  currentIteration,
  isRunning,
  className,
}: TokenCostMeterProps) {
  const usage = cumulativeUsage ?? {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  }

  const promptPct = maxContextTokens > 0 ? (usage.promptTokens / maxContextTokens) * 100 : 0
  const completionPct = maxContextTokens > 0 ? (usage.completionTokens / maxContextTokens) * 100 : 0
  const reasoningPct =
    usage.reasoningTokens && maxContextTokens > 0
      ? (usage.reasoningTokens / maxContextTokens) * 100
      : 0
  const totalPct = Math.min(promptPct + completionPct, 100)
  const compactionThreshold = 90

  return (
    <div
      className={cn(
        "border border-zinc-200 bg-zinc-50/80 rounded-2xl p-5 space-y-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-zinc-600" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Token &amp; Cost
        </h3>
        {isRunning && (
          <Brain className="h-3.5 w-3.5 text-blue-600 animate-pulse ml-auto" />
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Context Window Usage</span>
            <span className="text-zinc-700 font-medium tabular-nums">
              {formatNumber(usage.totalTokens)} / {formatNumber(maxContextTokens)}
            </span>
          </div>
          <div className="relative h-3 bg-zinc-200 rounded-full overflow-hidden">
            <div
              className="absolute inset-0 rounded-full transition-all duration-500"
              style={{
                background:
                  totalPct > compactionThreshold
                    ? "linear-gradient(90deg, #10b981 0%, #3b82f6 var(--prompt-end, 0%), #f59e0b var(--reasoning-start, 0%), #3b82f6 var(--completion-start, 0%), #3b82f6 100%)"
                    : undefined,
              }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(promptPct, 100)}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all duration-500"
              style={{
                width: `${Math.min(promptPct + completionPct, 100)}%`,
                opacity: 0.85,
              }}
            />
            {usage.reasoningTokens && usage.reasoningTokens > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-amber-400 transition-all duration-500"
                style={{
                  width: `${Math.min(reasoningPct, 100)}%`,
                  opacity: 0.7,
                }}
              />
            )}
            <div
              className={cn(
                "absolute inset-y-0 right-0 w-[10%] rounded-r-full border-l-2 border-red-400 bg-red-100/30",
              )}
              style={{ display: totalPct > compactionThreshold * 0.8 ? undefined : "none" }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>
              {totalPct.toFixed(1)}% used
              {totalPct > compactionThreshold && (
                <span className="text-red-500 ml-1 font-medium">
                  &middot; Compaction threshold
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="border border-zinc-200 bg-white rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs text-zinc-500">Total Cost</span>
            </div>
            <p className="text-sm font-semibold text-zinc-800 tabular-nums">
              ${totalCost.toFixed(4)}
            </p>
          </div>

          <div className="border border-zinc-200 bg-white rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs text-zinc-500">Iteration</span>
            </div>
            <p className="text-sm font-semibold text-zinc-800 tabular-nums">
              {currentIteration} / {maxIterations}
            </p>
          </div>
        </div>

        <div className="border border-zinc-200 bg-white rounded-xl p-3 space-y-1.5">
          <span className="text-xs text-zinc-500">Token Breakdown</span>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span className="text-zinc-700">
              Prompt:{" "}
              <span className="font-mono font-medium text-emerald-600">
                {formatNumber(usage.promptTokens)}
              </span>
            </span>
            <span className="text-zinc-700">
              Completion:{" "}
              <span className="font-mono font-medium text-blue-600">
                {formatNumber(usage.completionTokens)}
              </span>
            </span>
            {usage.reasoningTokens !== undefined && (
              <span className="text-zinc-700">
                Reasoning:{" "}
                <span className="font-mono font-medium text-amber-600">
                  {formatNumber(usage.reasoningTokens)}
                </span>
              </span>
            )}
            {usage.cachedTokens !== undefined && usage.cachedTokens > 0 && (
              <span className="text-zinc-700">
                Cached:{" "}
                <span className="font-mono font-medium text-purple-600">
                  {formatNumber(usage.cachedTokens)}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
