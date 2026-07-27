"use client"

import React, { useState } from "react"
import { cn } from "@/utils/cn"
import {
  ListChecks,
  Clock,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  SkipForward,
} from "lucide-react"

interface TimelineEvent {
  name: string
  args: Record<string, unknown>
  startedAt: number
  duration?: number
  result?: string
  status: "running" | "completed" | "failed" | "skipped"
}

interface ToolTimelineProps {
  toolCalls: TimelineEvent[]
  isRunning: boolean
  className?: string
}

const statusConfig: Record<
  string,
  { icon: React.ReactNode; dot: string; bar: string }
> = {
  running: {
    icon: <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />,
    dot: "bg-blue-500",
    bar: "bg-blue-400",
  },
  completed: {
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
    dot: "bg-emerald-500",
    bar: "bg-emerald-400",
  },
  failed: {
    icon: <XCircle className="h-3.5 w-3.5 text-red-600" />,
    dot: "bg-red-500",
    bar: "bg-red-400",
  },
  skipped: {
    icon: <SkipForward className="h-3.5 w-3.5 text-zinc-400" />,
    dot: "bg-zinc-300",
    bar: "bg-zinc-300",
  },
}

export function ToolTimeline({ toolCalls, isRunning, className }: ToolTimelineProps) {
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const maxDuration = Math.max(...toolCalls.map((t) => t.duration ?? 0), 1)

  const toggleExpand = (name: string) => {
    setExpandedMap((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <div
      className={cn(
        "border border-zinc-200 bg-zinc-50/80 rounded-2xl p-5 space-y-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-zinc-600" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Tool Timeline
        </h3>
        {isRunning && (
          <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin ml-auto" />
        )}
      </div>

      {toolCalls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="h-6 w-6 text-zinc-300 mb-2" />
          <p className="text-xs text-zinc-400">No tool calls recorded yet</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-zinc-200" />
          <div className="space-y-3">
            {toolCalls.map((event, idx) => {
              const cfg = statusConfig[event.status] ?? statusConfig.skipped
              const isExpanded = expandedMap[`${event.name}-${idx}`] ?? false
              const barWidth =
                event.duration != null
                  ? (event.duration / maxDuration) * 100
                  : 0

              return (
                <div key={`${event.name}-${idx}`} className="relative pl-8">
                  <div
                    className={cn(
                      "absolute left-[5px] top-[6px] h-3.5 w-3.5 rounded-full border-2 border-white",
                      cfg.dot,
                    )}
                  />
                  <div className="border border-zinc-200 bg-white rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {cfg.icon}
                        <button
                          onClick={() => toggleExpand(`${event.name}-${idx}`)}
                          className="text-xs font-medium text-zinc-700 hover:text-zinc-900 transition-colors text-left"
                          aria-label={`Toggle ${event.name} details`}
                        >
                          {event.name}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {event.duration != null && (
                          <span
                            className="text-xs text-zinc-400 tabular-nums"
                            title={`${event.duration}ms`}
                          >
                            <Clock className="h-3 w-3 inline mr-0.5" />
                            {event.duration}ms
                          </span>
                        )}
                        {event.args && Object.keys(event.args).length > 0 && (
                          <button
                            onClick={() => toggleExpand(`${event.name}-${idx}`)}
                            className="p-0.5 hover:bg-zinc-200 rounded transition-colors"
                            aria-label={isExpanded ? "Collapse args" : "Expand args"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {event.duration != null && barWidth > 0 && (
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", cfg.bar)}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    )}

                    {isExpanded && event.args && Object.keys(event.args).length > 0 && (
                      <pre className="text-xs text-zinc-600 font-mono bg-zinc-50 p-2 rounded-lg overflow-auto max-h-32 whitespace-pre-wrap break-all border border-zinc-100">
                        {JSON.stringify(event.args, null, 2)}
                      </pre>
                    )}

                    {event.result && (
                      <p className="text-xs text-zinc-400 font-mono line-clamp-2">
                        {event.result}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
