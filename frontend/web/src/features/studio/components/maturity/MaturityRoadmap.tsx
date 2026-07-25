"use client"

import React from "react"
import { CheckCircle2, Clock, Circle, ArrowUpRight, ShieldCheck, Flame } from "lucide-react"
import type { RoadmapItem } from "../../types"

export interface MaturityRoadmapProps {
  items: readonly RoadmapItem[]
  onToggleStatus?: (id: string) => void
}

export function MaturityRoadmap({ items, onToggleStatus }: MaturityRoadmapProps) {
  const completedCount = items.filter((i) => i.status === "completed").length
  const progressPercent = Math.round((completedCount / items.length) * 100)

  return (
    <div className="space-y-6">
      <div className="border border-zinc-800/80 bg-zinc-900/40 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              Echo Self-Assessment Roadmap (L3 → L4 Validated)
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Priority plan to transition Echo from L3 (Structured) to L4 (Validated) across all 7 dimensions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-bold text-zinc-100">{progressPercent}% Completed</div>
              <div className="text-[10px] text-zinc-500">{completedCount} of {items.length} milestones</div>
            </div>
            <div className="h-10 w-24 bg-zinc-950 rounded-lg p-1 border border-zinc-800 flex items-center">
              <div
                className="h-full bg-emerald-500 rounded-md transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Roadmap Items List */}
        <div className="space-y-3">
          {items.map((item) => {
            const isCompleted = item.status === "completed"
            const isInProgress = item.status === "in_progress"

            return (
              <div
                key={item.id}
                onClick={() => onToggleStatus?.(item.id)}
                className={`border rounded-xl p-4 transition-all duration-150 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isCompleted
                    ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                    : isInProgress
                    ? "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10"
                    : "border-zinc-800/80 bg-zinc-950/40 hover:bg-zinc-800/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : isInProgress ? (
                      <Clock className="h-5 w-5 text-blue-400 animate-spin" />
                    ) : (
                      <Circle className="h-5 w-5 text-zinc-600" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-100">{item.title}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase ${
                          item.priority === "high"
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : item.priority === "medium"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700"
                        }`}
                      >
                        {item.priority}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span
                    className={`text-xs font-mono px-2.5 py-1 rounded-md font-semibold ${
                      isCompleted
                        ? "bg-emerald-500/20 text-emerald-300"
                        : isInProgress
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    Target: {item.targetLevel}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-zinc-500" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
