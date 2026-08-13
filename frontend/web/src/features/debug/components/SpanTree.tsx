"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import type { Span } from "@/features/debug/stores/traceStore";
import { cn } from "@/utils/cn";
import { buildSpanTree, formatDuration, getSpanColorClass, getSpanIcon, getVisibleNodes } from "./span-tree-helpers";

interface SpanTreeProps {
  spans: Span[];
  selectedSpanId: string | null;
  onSelectSpan: (spanId: string) => void;
  collapsedSpans: Set<string>;
  onToggleCollapse: (spanId: string) => void;
  compact?: boolean;
  emptyMessage?: string;
}

export function SpanTree({
  spans,
  selectedSpanId,
  onSelectSpan,
  collapsedSpans,
  onToggleCollapse,
  compact = false,
  emptyMessage,
}: SpanTreeProps) {
  const spanTree = useMemo(() => buildSpanTree(spans), [spans]);
  const visibleNodes = useMemo(() => getVisibleNodes(spanTree, collapsedSpans), [spanTree, collapsedSpans]);

  if (visibleNodes.length === 0 && emptyMessage) {
    return <div className="text-center py-20 text-xs text-zinc-400 dark:text-zinc-500">{emptyMessage}</div>;
  }

  return (
    <>
      {visibleNodes.map(({ node, hasChildren }) => {
        const isSelected = selectedSpanId === node.span.id;
        const isCollapsed = collapsedSpans.has(node.span.id);

        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: Tree node navigation
          // biome-ignore lint/a11y/useKeyWithClickEvents: Tree node navigation
          <div
            key={node.span.id}
            onClick={() => onSelectSpan(node.span.id)}
            style={{ paddingLeft: `${node.depth * (compact ? 12 : 14)}px` }}
            className={cn(
              "flex items-center justify-between border border-transparent cursor-pointer transition-all select-none group",
              compact
                ? "p-1.5 rounded-lg hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50"
                : "p-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
              isSelected
                ? "bg-purple-500/10 border-purple-500/20 text-purple-950 dark:text-purple-300 font-bold"
                : compact
                  ? "text-zinc-600 dark:text-zinc-400"
                  : "text-zinc-700 dark:text-zinc-300",
            )}
          >
            <div className={cn("flex items-center min-w-0", compact ? "gap-1.5" : "gap-2")}>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCollapse(node.span.id);
                  }}
                  className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
                >
                  {isCollapsed ? (
                    <ChevronRight className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
                  ) : (
                    <ChevronDown className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
                  )}
                </button>
              ) : (
                <div className={compact ? "w-3.5" : "w-4"} />
              )}

              <div
                className={cn(
                  "border flex items-center justify-center shrink-0 shadow-sm",
                  compact ? "p-0.5 rounded" : "p-1 rounded-lg",
                  getSpanColorClass(node.span),
                )}
              >
                {getSpanIcon(node.span)}
              </div>

              <span className="truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                {node.span.name}
              </span>
            </div>

            <div
              className={cn(
                "flex items-center gap-2 shrink-0 text-zinc-400 dark:text-zinc-500",
                compact ? "text-[8px] ml-2" : "text-[10px]",
              )}
            >
              <span>{formatDuration(node.span.durationMs)}</span>
              {!compact && node.span.status === "streaming" && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
