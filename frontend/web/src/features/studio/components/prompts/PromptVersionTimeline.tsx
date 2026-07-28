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
    <div className="space-y-1">
      {sorted.map((v) => {
        const isSelected = selectedVersion === v.version;
        const isLive = activeVersion === v.version;
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v.version)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 border",
              isSelected ? "bg-blue-50 border-blue-200" : "border-transparent hover:bg-zinc-100",
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border",
                isLive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                  : "bg-zinc-100 text-zinc-500 border-zinc-200",
              )}
            >
              v{v.version}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900">Version {v.version}</span>
                {isLive && (
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Live</span>
                )}
              </div>
              <div className="text-xs text-zinc-500">
                {v.created_by} · {new Date(v.created_at).toLocaleDateString()}
              </div>
            </div>
            <VersionStatusBadge status={v.status} />
          </button>
        );
      })}
    </div>
  );
}
