"use client";

import { useMemo } from "react";
import { cn } from "@/utils/cn";

interface VersionDiffViewerProps {
  oldText: string;
  newText: string;
  oldLabel: string;
  newLabel: string;
}

interface DiffLine {
  type: "same" | "added" | "removed";
  content: string;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  let i = 0,
    j = 0;

  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: "same", content: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "removed", content: oldLines[i] });
      i++;
    } else {
      result.push({ type: "added", content: newLines[j] });
      j++;
    }
  }

  while (i < m) {
    result.push({ type: "removed", content: oldLines[i] });
    i++;
  }

  while (j < n) {
    result.push({ type: "added", content: newLines[j] });
    j++;
  }

  return result;
}

export function VersionDiffViewer({ oldText, newText, oldLabel, newLabel }: VersionDiffViewerProps) {
  const diff = useMemo(() => computeDiff(oldText, newText), [oldText, newText]);

  const addedCount = diff.filter((d) => d.type === "added").length;
  const removedCount = diff.filter((d) => d.type === "removed").length;

  return (
    <div className="border border-border bg-surface rounded-md overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-surface-hover">
        <div className="text-xs font-semibold text-foreground">
          {oldLabel} → {newLabel}
        </div>
        <div className="flex items-center gap-3 text-xs font-bold">
          <span className="text-success">
            +{addedCount}
            <span className="sr-only"> lines added</span>
          </span>
          <span className="text-danger">
            −{removedCount}
            <span className="sr-only"> lines removed</span>
          </span>
        </div>
      </div>
      <div className="max-h-[500px] overflow-y-auto font-mono text-xs">
        {diff.map((line, idx) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no stable id and are static per render
            key={idx}
            className={cn(
              "px-4 py-1 whitespace-pre-wrap break-all",
              line.type === "added" && "bg-success/10 text-success font-medium",
              line.type === "removed" && "bg-danger/10 text-danger font-medium",
              line.type === "same" && "text-foreground",
            )}
          >
            <span className="inline-block w-5 select-none text-muted" aria-hidden="true">
              {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
            </span>
            {line.type !== "same" && <span className="sr-only">{line.type === "added" ? "Added: " : "Removed: "}</span>}
            {line.content || " "}
          </div>
        ))}
      </div>
    </div>
  );
}
