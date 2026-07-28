"use client";

import { Brain, Loader2 } from "lucide-react";
import React from "react";
import { cn } from "@/utils/cn";
import type { PlaygroundResult } from "../../types";

interface ModelComparisonGridProps {
  results: PlaygroundResult[];
  isLoading: boolean;
  streamingContent?: Record<string, string>;
  streamingReasoning?: Record<string, string>;
  selectedModels?: string[];
}

export function ModelComparisonGrid({
  results,
  isLoading,
  streamingContent,
  streamingReasoning,
  selectedModels,
}: ModelComparisonGridProps) {
  if (!isLoading && (!results || results.length === 0)) return null;

  if (
    isLoading &&
    (!streamingContent || Object.keys(streamingContent).length === 0) &&
    (!streamingReasoning || Object.keys(streamingReasoning).length === 0) &&
    (!results || results.length === 0)
  ) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(selectedModels ?? [1, 2, 3]).map((m, i) => (
          <div
            key={typeof m === "string" ? m : i}
            className="border border-zinc-200 bg-zinc-50 rounded-2xl p-4 space-y-3"
          >
            <div className="h-5 w-24 bg-zinc-200 rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 bg-zinc-200 rounded animate-pulse" />
              <div className="h-3 bg-zinc-200 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-zinc-200 rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const allModels = new Set<string>();
  for (const r of results ?? []) allModels.add(r.model);
  for (const m of Object.keys(streamingContent ?? {})) allModels.add(m);
  for (const m of Object.keys(streamingReasoning ?? {})) allModels.add(m);
  for (const m of selectedModels ?? []) allModels.add(m);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {(() => {
        const resultsByModel = new Map((results ?? []).map((r) => [r.model, r]));
        return Array.from(allModels).map((model) => {
          const result = resultsByModel.get(model);
          const streaming = streamingContent?.[model];
          const reasoning = streamingReasoning?.[model];

          if (result) {
            return (
              <div
                key={model}
                className={cn(
                  "border rounded-2xl p-4 space-y-3 transition-all",
                  result.error ? "border-red-200 bg-red-50" : "border-zinc-200 bg-zinc-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-800">{model}</h3>
                    {result.reasoning && <Brain className="h-3 w-3 text-amber-500" />}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                    {result.latency_ms > 0 && <span>{result.latency_ms}ms</span>}
                    {result.tokens > 0 && <span>{result.tokens} tok</span>}
                  </div>
                </div>
                {result.reasoning && (
                  <details className="text-xs">
                    <summary className="text-amber-600 cursor-pointer hover:text-amber-700 select-none mb-1">
                      Thinking trace
                    </summary>
                    <pre className="text-amber-700/70 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto border border-amber-200 bg-amber-50/50 rounded-lg p-2">
                      {result.reasoning}
                    </pre>
                  </details>
                )}
                {result.error ? (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                    {result.error}
                  </div>
                ) : (
                  <pre className="text-xs text-zinc-700 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
                    {result.content}
                  </pre>
                )}
              </div>
            );
          }

          return (
            <div key={model} className="border border-blue-200 bg-blue-50/50 rounded-2xl p-4 space-y-3 transition-all">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-800">{model}</h3>
                <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
              </div>
              {reasoning && (
                <div className="text-xs text-amber-700/70 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto border border-amber-200 bg-amber-50/50 rounded-lg p-2 mb-2">
                  {reasoning}
                  <span className="inline-block w-1.5 h-3.5 bg-amber-400 animate-pulse ml-0.5" />
                </div>
              )}
              {streaming ? (
                <pre className="text-xs text-zinc-700 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
                  {streaming}
                  <span className="inline-block w-1.5 h-3.5 bg-blue-500 animate-pulse ml-0.5" />
                </pre>
              ) : (
                !reasoning && (
                  <div className="space-y-2">
                    <div className="h-3 bg-zinc-200 rounded animate-pulse" />
                    <div className="h-3 bg-zinc-200 rounded animate-pulse w-3/4" />
                  </div>
                )
              )}
            </div>
          );
        });
      })()}
    </div>
  );
}
