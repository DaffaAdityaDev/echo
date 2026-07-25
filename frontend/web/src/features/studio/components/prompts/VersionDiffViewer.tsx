"use client"

import React, { useMemo } from "react"
import { cn } from "@/utils/cn"

interface VersionDiffViewerProps {
  oldText: string
  newText: string
  oldLabel: string
  newLabel: string
}

interface DiffLine {
  type: "same" | "added" | "removed"
  content: string
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")
  const result: DiffLine[] = []

  // Simple LCS-based diff
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) dp[i][j] = dp[i + 1][j + 1] + 1
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  let i = 0, j = 0
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: "same", content: oldLines[i] })
      i++; j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "removed", content: oldLines[i] })
      i++
    } else {
      result.push({ type: "added", content: newLines[j] })
      j++
    }
  }
  while (i < m) { result.push({ type: "removed", content: oldLines[i] }); i++ }
  while (j < n) { result.push({ type: "added", content: newLines[j] }); j++ }

  return result
}

export function VersionDiffViewer({ oldText, newText, oldLabel, newLabel }: VersionDiffViewerProps) {
  const diff = useMemo(() => computeDiff(oldText, newText), [oldText, newText])

  const addedCount = diff.filter(d => d.type === "added").length
  const removedCount = diff.filter(d => d.type === "removed").length

  return (
    <div className="border border-zinc-800/60 bg-zinc-950/60 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/60 bg-zinc-900/40">
        <div className="text-xs font-semibold text-zinc-300">
          {oldLabel} → {newLabel}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">+{addedCount}</span>
          <span className="text-red-400">−{removedCount}</span>
        </div>
      </div>
      <div className="max-h-[500px] overflow-y-auto font-mono text-xs">
        {diff.map((line, idx) => (
          <div
            key={idx}
            className={cn(
              "px-4 py-1 whitespace-pre-wrap break-all",
              line.type === "added" && "bg-emerald-500/10 text-emerald-300",
              line.type === "removed" && "bg-red-500/10 text-red-300",
              line.type === "same" && "text-zinc-500"
            )}
          >
            <span className="inline-block w-5 select-none text-zinc-600">
              {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
            </span>
            {line.content || " "}
          </div>
        ))}
      </div>
    </div>
  )
}
