"use client";

import { cn } from "@/utils/cn";
import { useChatStore } from "../stores/chatStore";
import type { AgentState } from "../types";

interface AgentStatusBadgeProps {
  state?: AgentState;
  className?: string;
}

const NEUTRAL = "bg-surface-hover text-muted border-border";
const SUCCESS = "bg-success/10 text-success border-success/30";
const WARNING = "bg-warning/10 text-warning border-warning/30";
const DANGER = "bg-danger/10 text-danger border-danger/30";

const stateConfig: Record<AgentState, { label: string; className: string }> = {
  starting: { label: "Starting...", className: NEUTRAL },
  running: { label: "Running", className: SUCCESS },
  looping: { label: "Looping", className: WARNING },
  stalled: { label: "Stalled", className: WARNING },
  degraded: { label: "Degraded", className: DANGER },
  completed: { label: "Completed", className: SUCCESS },
  aborted: { label: "Aborted", className: NEUTRAL },
  error: { label: "Error", className: DANGER },
};

export function AgentStatusBadge({ state, className }: AgentStatusBadgeProps) {
  const storeState = useChatStore((s) => s.agentState);
  const resolvedState = state ?? storeState;

  if (!resolvedState) return null;

  const config = stateConfig[resolvedState];

  return (
    <span
      className={cn(
        "text-2xs font-semibold px-1.5 py-0.5 rounded-sm uppercase tracking-wider border whitespace-nowrap",
        config.className,
        className,
      )}
    >
      <span className="sr-only">Agent status: </span>
      {config.label}
    </span>
  );
}
