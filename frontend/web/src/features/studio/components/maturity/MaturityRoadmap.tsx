"use client"

import React from "react"
import { CheckCircle2, Clock, Circle, ArrowUpRight, ShieldCheck } from "lucide-react"
import type { RoadmapItem } from "../../types"

export interface MaturityRoadmapProps {
  items: readonly RoadmapItem[]
  onToggleStatus?: (id: string) => void
}

export function MaturityRoadmap({ items, onToggleStatus }: MaturityRoadmapProps) {
  const completedCount = items.filter((i) => i.status === "completed").length
  const progressPercent = Math.round((completedCount / items.length) * 100)

  return (
    <div className="space-y-6 font-mono text-foreground">
      <div className="border border-border bg-white rounded-xs p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              Echo Self-Assessment Roadmap (L3 â†’ L4 Validated)
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Priority plan to transition Echo from L3 (Structured) to L4 (Validated) across all 7 dimensions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-bold text-foreground">{progressPercent}% Completed</div>
              <div className="text-[10px] text-slate-600">{completedCount} of {items.length} milestones</div>
            </div>
            <div className="h-9 w-24 bg-surface rounded-xs p-1 border border-border flex items-center">
              <div
                className="h-full bg-success rounded-[1px] transition-all duration-300"
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
                className={`border rounded-xs p-4 transition-all duration-150 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isCompleted
                    ? "border-success bg-emerald-50 text-emerald-700"
                    : isInProgress
                    ? "border-gb-bright-blue bg-blue-50 text-gb-dark-blue"
                    : "border-border bg-surface hover:bg-white text-foreground"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                    ) : isInProgress ? (
                      <Clock className="h-5 w-5 text-gb-blue animate-spin" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-400" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{item.title}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-xs border uppercase font-bold ${
                          item.priority === "high"
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : item.priority === "medium"
                            ? "bg-amber-100 text-amber-900 border-amber-300"
                            : "bg-slate-100 text-slate-600 border-slate-300"
                        }`}
                      >
                        {item.priority}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <span
                    className={`text-xs font-mono px-2.5 py-1 rounded-xs font-bold ${
                      isCompleted
                        ? "bg-success text-white"
                        : isInProgress
                        ? "bg-gb-blue text-white"
                        : "bg-border text-foreground"
                    }`}
                  >
                    Target: {item.targetLevel}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

