"use client"

import React from "react"
import { cn } from "@/utils/cn"
import { Activity, Layers, ShieldAlert, AlertTriangle } from "lucide-react"

interface AgentStatus {
  state: "starting" | "running" | "looping" | "stalled" | "degraded" | "completed" | "aborted" | "error"
  step: number
  throughput: number
  activeBreakers: string[]
  currentTool?: string
  thought?: string
  lastActivity: number
}

interface StatusDashboardProps {
  agentStatus: AgentStatus | null
  degradationLevel: string
  missionState: string
  strategy: string | undefined
  isRunning: boolean
  className?: string
}

const stateColors: Record<string, string> = {
  running: "bg-emerald-500",
  looping: "bg-amber-400",
  stalled: "bg-amber-500",
  degraded: "bg-red-500",
  error: "bg-red-600",
  starting: "bg-zinc-400",
  completed: "bg-emerald-600",
  aborted: "bg-zinc-500",
}

const stateBgColors: Record<string, string> = {
  running: "bg-emerald-50 border-emerald-200 text-emerald-700",
  looping: "bg-amber-50 border-amber-200 text-amber-700",
  stalled: "bg-amber-50 border-amber-200 text-amber-700",
  degraded: "bg-red-50 border-red-200 text-red-700",
  error: "bg-red-50 border-red-200 text-red-700",
  starting: "bg-zinc-100 border-zinc-200 text-zinc-600",
  completed: "bg-emerald-50 border-emerald-200 text-emerald-700",
  aborted: "bg-zinc-100 border-zinc-200 text-zinc-600",
}

const degradationPills: Record<string, { label: string; class: string }> = {
  none: { label: "Normal", class: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  restricted: { label: "Restricted", class: "bg-amber-100 text-amber-700 border-amber-200" },
  degraded: { label: "Degraded", class: "bg-red-100 text-red-700 border-red-200" },
}

export function StatusDashboard({
  agentStatus,
  degradationLevel,
  missionState,
  strategy,
  isRunning,
  className,
}: StatusDashboardProps) {
  const state = agentStatus?.state ?? "starting"
  const deg = degradationPills[degradationLevel] ?? degradationPills.none
  const breakers = agentStatus?.activeBreakers ?? []

  return (
    <div
      className={cn(
        "border border-zinc-200 bg-zinc-50/80 rounded-2xl p-5 space-y-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-zinc-600" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Status Dashboard
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="border border-zinc-200 bg-white rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-500">Agent State</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", stateColors[state] ?? "bg-zinc-400")} />
            <span
              className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full border",
                stateBgColors[state] ?? "bg-zinc-100 text-zinc-600 border-zinc-200",
              )}
            >
              {state}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Step {agentStatus?.step ?? 0}
            {agentStatus?.currentTool && (
              <span className="ml-1">&middot; Tool: {agentStatus.currentTool}</span>
            )}
          </p>
        </div>

        <div className="border border-zinc-200 bg-white rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-500">Strategy</span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
            {strategy ?? "standard"}
          </span>
          <p className="text-xs text-zinc-400">
            {isRunning ? "Active" : "Idle"} &middot; {missionState}
          </p>
        </div>

        <div className="border border-zinc-200 bg-white rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-500">Degradation</span>
          </div>
          <span
            className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full border",
              deg.class,
            )}
          >
            {deg.label}
          </span>
          <p className="text-xs text-zinc-400">
            Throughput: {agentStatus?.throughput.toFixed(1) ?? "0.0"} req/s
          </p>
        </div>

        <div className="border border-zinc-200 bg-white rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-500">Circuit Breakers</span>
          </div>
          {breakers.length === 0 ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200">
              None
            </span>
          ) : (
            <div className="space-y-1">
              {breakers.map((breaker, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-xs text-zinc-600"
                >
                  <ShieldAlert className="h-3 w-3 text-red-500" />
                  <span>{breaker}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
