"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Search, CheckCircle2, SkipForward } from "lucide-react";
import type { ThoughtStep } from "../types";
import { PACKET_TYPES } from "../constants";

interface ToolCallTimelineProps {
  steps: ThoughtStep[];
}

export function ToolCallTimeline({ steps }: ToolCallTimelineProps) {
  const [collapsed, setCollapsed] = useState(steps.length > 3);

  if (steps.length === 0) return null;

  const toolSteps = steps.filter(
    (s) => s.type === PACKET_TYPES.TOOL_CALL || s.type === PACKET_TYPES.TOOL_SKIP || s.type === PACKET_TYPES.TOOL_RESULT
  );

  if (toolSteps.length === 0) return null;

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase tracking-wider w-full text-left"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <span>Tool Calls ({toolSteps.length})</span>
      </button>
      {!collapsed && (
        <div className="mt-2 space-y-1.5">
          {toolSteps.map((step, idx) => (
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
      <div className="flex items-center gap-2 text-xs bg-accent/5 border border-accent/10 rounded-lg px-2.5 py-1.5">
        <Search size={10} className="text-accent shrink-0" aria-hidden="true" />
        <span className="font-semibold text-accent/80">Action: {step.toolName}</span>
      </div>
    );
  }

  if (step.type === PACKET_TYPES.TOOL_SKIP) {
    return (
      <div className="flex items-center gap-2 text-xs bg-white/[0.02] border border-white/5 rounded-lg px-2.5 py-1.5 italic text-white/40">
        <SkipForward size={10} className="text-white/30 shrink-0" aria-hidden="true" />
        <span>Skipped: {step.toolName} (circuit open)</span>
      </div>
    );
  }

  if (step.type === PACKET_TYPES.TOOL_RESULT) {
    return (
      <div className="flex items-center gap-2 text-xs bg-success/5 border border-success/10 rounded-lg px-2.5 py-1.5">
        <CheckCircle2 size={10} className="text-success shrink-0" aria-hidden="true" />
        <span className="font-semibold text-success/80">Result: {step.toolName}</span>
      </div>
    );
  }

  return null;
}
