"use client";

import { CheckCircle2, ChevronDown, ChevronRight, Search, SkipForward } from "lucide-react";
import { useId, useState } from "react";
import { PACKET_TYPES } from "../constants";
import type { ThoughtStep } from "../types";

interface ToolCallTimelineProps {
  steps: ThoughtStep[];
}

export function ToolCallTimeline({ steps }: ToolCallTimelineProps) {
  const [collapsed, setCollapsed] = useState(steps.length > 3);
  const listId = useId();

  if (steps.length === 0) return null;

  const toolSteps = steps.filter(
    (s) =>
      s.type === PACKET_TYPES.TOOL_CALL || s.type === PACKET_TYPES.TOOL_SKIP || s.type === PACKET_TYPES.TOOL_RESULT,
  );

  if (toolSteps.length === 0) return null;

  return (
    <div className="rounded-md bg-surface border border-border px-3 py-2">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        aria-controls={listId}
        className="flex items-center gap-2 text-2xs font-bold text-muted hover:text-foreground uppercase tracking-wider w-full text-left cursor-pointer"
      >
        {collapsed ? <ChevronRight size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
        <span>Tool Calls ({toolSteps.length})</span>
      </button>
      {!collapsed && (
        <div id={listId} className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
          {toolSteps.map((step, idx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: tool steps are transient stream snapshots without stable ids
            <ToolCallItem key={idx} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCallItem({ step }: { step: ThoughtStep }) {
  if (step.type === PACKET_TYPES.TOOL_CALL) {
    return (
      <div className="flex items-center gap-2 text-xs bg-accent-soft border border-accent/20 rounded-sm px-2.5 py-1.5">
        <Search size={12} className="text-accent shrink-0" aria-hidden="true" />
        <span className="font-semibold text-accent truncate">Action: {step.toolName}</span>
      </div>
    );
  }

  if (step.type === PACKET_TYPES.TOOL_SKIP) {
    return (
      <div className="flex items-center gap-2 text-xs bg-surface-hover border border-border rounded-sm px-2.5 py-1.5 italic text-muted">
        <SkipForward size={12} className="shrink-0" aria-hidden="true" />
        <span className="truncate">Skipped: {step.toolName} (circuit open)</span>
      </div>
    );
  }

  if (step.type === PACKET_TYPES.TOOL_RESULT) {
    return (
      <div className="flex items-center gap-2 text-xs bg-success/5 border border-success/20 rounded-sm px-2.5 py-1.5">
        <CheckCircle2 size={12} className="text-success shrink-0" aria-hidden="true" />
        <span className="font-semibold text-success truncate">Result: {step.toolName}</span>
      </div>
    );
  }

  return null;
}
