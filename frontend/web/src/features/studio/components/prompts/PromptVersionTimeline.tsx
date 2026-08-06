"use client";

import React from "react";
import { cn } from "@/utils/cn";
import type { PromptVersion } from "../../types";
import { VersionStatusBadge } from "./VersionStatusBadge";

export interface PromptVersionTimelineProps {
  versions: PromptVersion[];
  activeVersion: number;
  selectedVersion: number | null;
  onSelect: (version: number) => void;
}

export function PromptVersionTimeline({
  versions,
  activeVersion,
  selectedVersion,
  onSelect,
}: PromptVersionTimelineProps) {
  const sorted = [...versions].sort((a, b) => b.version - a.version);

  return (
    <div className="space-y-1.5">
      {sorted.map((v) => {
        const isSelected = selectedVersion === v.version;
        const isLive = activeVersion === v.version;
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v.version)}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 border cursor-pointer",
              isSelected
                ? "bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400 font-semibold shadow-sm"
                : "border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/40 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300",
            )}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0 border",
                  isLive
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
                )}
              >
                v{v.version}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Version {v.version}</span>
                  {isLive && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 uppercase tracking-wider">
                      Live
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {v.created_by} · {new Date(v.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="shrink-0 ml-2">
              <VersionStatusBadge status={v.status} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
