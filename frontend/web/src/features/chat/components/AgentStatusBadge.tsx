"use client";

import React from "react";
import { cn } from "@/utils/cn";
import { useChatStore } from "../stores/chatStore";
import type { AgentState } from "../types";

interface AgentStatusBadgeProps {
  state?: AgentState;
  className?: string;
}

const stateConfig: Record<AgentState, { label: string; className: string }> = {
  starting: { label: "Starting...", className: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700" },
  running: { label: "Running", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold" },
  looping: { label: "Looping", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 font-bold" },
  stalled: { label: "Stalled", className: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40" },
  degraded: { label: "Degraded", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/40 font-bold" },
  completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 font-bold" },
  aborted: { label: "Aborted", className: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/40" },
  error: { label: "Error", className: "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/50 font-bold" },
};

export function AgentStatusBadge({ state, className }: AgentStatusBadgeProps) {
  const storeState = useChatStore((s) => s.agentState);
  const resolvedState = state ?? storeState;
  const config = stateConfig[resolvedState];

  return (
    <span
      className={cn(
        "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider border",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
