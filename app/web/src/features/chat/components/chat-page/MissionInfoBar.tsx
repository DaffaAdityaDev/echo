"use client";

import { Sparkles, Target, Wrench } from "lucide-react";
import type { MissionMeta } from "../../types";

interface MissionInfoBarProps {
  missionMeta: MissionMeta | null;
  selectedFeatures: string[];
}

export function MissionInfoBar({ missionMeta, selectedFeatures }: MissionInfoBarProps) {
  return (
    <div className="h-10 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-950/30 px-6 flex items-center justify-between text-xs shrink-0 select-none overflow-x-auto">
      <div className="flex items-center gap-3">
        {/* Strategy Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold text-[11px] border border-purple-500/20">
          <Sparkles className="h-3 w-3" />
          <span>{missionMeta?.strategy ? `${missionMeta.strategy.toUpperCase()}` : "REACT AGENT"}</span>
        </div>

        {/* Objective Pill */}
        <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 text-[11px] font-medium truncate max-w-xs md:max-w-md">
          <Target className="h-3 w-3 text-purple-500 shrink-0" />
          <span className="truncate">{missionMeta?.objective || "Autonomous AI Harness Engine"}</span>
        </div>
      </div>

      {/* Active Tools Count */}
      <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-300/40 dark:border-zinc-700/40">
          <Wrench className="h-3 w-3 text-purple-400" />
          {missionMeta?.toolsAvailable && missionMeta.toolsAvailable.length > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {missionMeta.toolsAvailable.length}
              </span>
              <span className="hidden sm:inline">
                {missionMeta.toolsAvailable.length === 1 ? "Capability Active:" : "Capabilities Active:"}
              </span>
              <span className="font-mono text-purple-500 dark:text-purple-400 truncate max-w-[16rem]">
                {missionMeta.toolsAvailable.join(", ")}
              </span>
            </span>
          ) : (
            <span>{selectedFeatures.length} Capabilities Active</span>
          )}
        </div>
      </div>
    </div>
  );
}
