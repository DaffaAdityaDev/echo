"use client"

import React from "react"
import { ShieldCheck, ArrowRight, Sparkles, AlertTriangle, Layers } from "lucide-react"
import type { MaturityDimension, MaturityLevelInfo } from "../../types"

export interface MaturityMatrixProps {
  dimensions: readonly MaturityDimension[]
  levels: readonly MaturityLevelInfo[]
  weakestDimension?: string
}

export function MaturityMatrix({ dimensions, levels, weakestDimension }: MaturityMatrixProps) {
  return (
    <div className="space-y-6">
      <div className="border border-zinc-800/80 bg-zinc-900/40 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-400" />
              AI-Ready 7-Dimension Maturity Matrix
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Pattern-agnostic evaluation matrix. Current placement maps to Structured (L3) baseline with Validated (L4) guardrails.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            Weakest Link Rule: Lowest dimension sets overall system level
          </div>
        </div>

        {/* Matrix Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400">
                <th className="py-3 px-4 font-semibold w-40">Dimension</th>
                <th className="py-3 px-4 font-semibold w-32">Current State</th>
                <th className="py-3 px-4 font-semibold">L3: Structured (Today)</th>
                <th className="py-3 px-4 font-semibold">L4: Validated (Target)</th>
                <th className="py-3 px-4 font-semibold w-48">Next Pattern Slot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {dimensions.map((dim) => {
                const isWeakest = dim.key === weakestDimension
                return (
                  <tr
                    key={dim.key}
                    className={`transition-colors hover:bg-zinc-800/20 ${
                      isWeakest ? "bg-amber-500/5" : ""
                    }`}
                  >
                    <td className="py-4 px-4 font-semibold text-zinc-200">
                      <div className="flex items-center gap-2">
                        <span>{dim.name}</span>
                        {isWeakest && (
                          <span
                            title="Weakest Link Dimension"
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-normal"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Bottleneck
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 font-normal mt-0.5 max-w-[140px]">
                        {dim.description}
                      </p>
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-xs font-semibold ${
                          dim.currentLevel === "L4"
                            ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                            : dim.currentLevel === "L3"
                            ? "bg-blue-500/15 border border-blue-500/30 text-blue-400"
                            : "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                        }`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {dim.currentLevel}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-zinc-300 text-[11px] leading-relaxed max-w-xs">
                      {dim.l3Pattern}
                    </td>

                    <td className="py-4 px-4 text-zinc-300 text-[11px] leading-relaxed max-w-xs font-mono text-emerald-300/90">
                      {dim.l4Pattern}
                    </td>

                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-md">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        {dim.nextSlot || "Self-healing"}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5 Levels Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {levels.map((lvl) => (
          <div
            key={lvl.level}
            className={`border rounded-xl p-4 transition-all ${lvl.color}`}
          >
            <div className="flex items-center justify-between font-mono font-bold text-sm">
              <span>{lvl.level}</span>
              <span className="text-xs uppercase font-normal tracking-wide">{lvl.name}</span>
            </div>
            <p className="text-[11px] font-semibold mt-2 line-clamp-2 leading-tight">
              {lvl.definition}
            </p>
            <p className="text-[10px] opacity-80 mt-1 line-clamp-2">
              {lvl.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
