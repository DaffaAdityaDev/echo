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
    return (
      <p role="status" className="text-center py-20 text-xs text-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <>
      {visibleNodes.map(({ node, hasChildren }) => {
        const isSelected = selectedSpanId === node.span.id;
        const isCollapsed = collapsedSpans.has(node.span.id);

        return (
          <div
            key={node.span.id}
            style={{ paddingLeft: `${node.depth * (compact ? 12 : 14)}px` }}
            className={cn(
              "flex items-center border border-transparent transition-all group",
              compact ? "p-1.5 rounded-sm hover:bg-surface-hover gap-1.5" : "p-2 rounded-sm hover:bg-surface gap-2",
              isSelected
                ? "bg-accent/10 border-accent/20 text-accent font-bold"
                : compact
                  ? "text-muted"
                  : "text-foreground",
            )}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={() => onToggleCollapse(node.span.id)}
                aria-expanded={!isCollapsed}
                aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.span.name}`}
                className="p-0.5 rounded-sm hover:bg-border transition-colors text-muted hover:text-foreground cursor-pointer shrink-0"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3 w-3" aria-hidden="true" />
                )}
              </button>
            ) : (
              <span className="w-4 shrink-0" aria-hidden="true" />
            )}

            <button
              type="button"
              onClick={() => onSelectSpan(node.span.id)}
              aria-pressed={isSelected}
              className={cn(
                "flex flex-1 items-center justify-between min-w-0 text-left cursor-pointer rounded-sm",
                compact ? "gap-1.5" : "gap-2",
              )}
            >
              <span className={cn("flex items-center min-w-0", compact ? "gap-1.5" : "gap-2")}>
                <span
                  className={cn(
                    "border flex items-center justify-center shrink-0",
                    compact ? "p-0.5 rounded-sm" : "p-1 rounded-sm",
                    getSpanColorClass(node.span),
                  )}
                >
                  {getSpanIcon(node.span)}
                </span>
                <span className="truncate group-hover:text-accent transition-colors">{node.span.name}</span>
              </span>

              <span className="flex items-center gap-2 shrink-0 text-muted text-2xs">
                <span>{formatDuration(node.span.durationMs)}</span>
                {!compact && node.span.status === "streaming" && (
                  <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
                  </span>
                )}
              </span>
            </button>
          </div>
        );
      })}
    </>
  );
}
