"use client";

import React from "react";
import { cn } from "@/utils/cn";
import type { AgentState } from "../types";
import { useChatStore } from "../stores/chatStore";

interface AgentStatusBadgeProps {
  state?: AgentState;
  className?: string;
}

const stateConfig: Record<AgentState, { label: string; className: string }> = {
  starting: { label: "Starting...", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  running: { label: "Running", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  looping: { label: "Looping", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  stalled: { label: "Stalled", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  degraded: { label: "Degraded", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  completed: { label: "Completed", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  aborted: { label: "Aborted", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export function AgentStatusBadge({ state, className }: AgentStatusBadgeProps) {
  const storeState = useChatStore((s) => s.agentState);
  const resolvedState = state ?? storeState;
  const config = stateConfig[resolvedState];

  return (
    <span className={cn(
      "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider border",
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}
