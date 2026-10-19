"use client";

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
            type="button"
            onClick={() => onSelect(v.version)}
            aria-pressed={isSelected}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-left transition-all duration-150 border cursor-pointer",
              isSelected
                ? "bg-accent/10 border-accent/30 text-accent font-semibold"
                : "border-border bg-elevated hover:bg-surface-hover text-foreground",
            )}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                aria-hidden="true"
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold font-mono shrink-0 border",
                  isLive ? "bg-success/15 text-success border-success/30" : "bg-surface-hover text-muted border-border",
                )}
              >
                v{v.version}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">Version {v.version}</span>
                  {isLive && (
                    <span className="px-1.5 py-0.5 rounded-sm text-2xs font-extrabold text-success bg-success/15 uppercase tracking-wider">
                      Live
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted truncate">
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
