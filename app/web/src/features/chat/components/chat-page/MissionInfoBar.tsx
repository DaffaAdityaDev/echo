"use client";

import { Sparkles, Target, Wrench } from "lucide-react";
import type { MissionMeta } from "../../types";

interface MissionInfoBarProps {
  missionMeta: MissionMeta | null;
  selectedFeatures: string[];
}

function capabilityLabel(count: number): string {
  return count === 1 ? "Capability Active" : "Capabilities Active";
}

export function MissionInfoBar({ missionMeta, selectedFeatures }: MissionInfoBarProps) {
  const tools = missionMeta?.toolsAvailable ?? [];
  const capabilityCount = tools.length > 0 ? tools.length : selectedFeatures.length;

  return (
    <div className="min-h-10 border-b border-border bg-surface/60 px-3 sm:px-6 py-1.5 flex items-center justify-between gap-3 text-xs shrink-0 select-none">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-accent-soft text-accent font-semibold text-2xs uppercase tracking-wider border border-accent/20 shrink-0">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          <span>{missionMeta?.strategy ? missionMeta.strategy.toUpperCase() : "REACT AGENT"}</span>
        </div>

        <div className="flex items-center gap-1.5 text-muted font-medium min-w-0">
          <Target className="h-3 w-3 text-accent shrink-0" aria-hidden="true" />
          <span className="truncate">{missionMeta?.objective || "Autonomous AI Harness Engine"}</span>
        </div>
      </div>

      <div
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-surface-hover border border-border text-muted shrink-0 min-w-0"
        title={tools.length > 0 ? tools.join(", ") : undefined}
      >
        <Wrench className="h-3 w-3 text-accent shrink-0" aria-hidden="true" />
        <span className="font-semibold text-foreground">{capabilityCount}</span>
        <span className="hidden sm:inline">{capabilityLabel(capabilityCount)}</span>
        {tools.length > 0 && (
          <span className="hidden lg:inline font-mono text-accent truncate max-w-[16rem]">: {tools.join(", ")}</span>
        )}
      </div>
    </div>
  );
}
