"use client";

import { AlertCircle, ArrowLeft, Clock, Coins, Cpu } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { SpanTree } from "@/features/debug/components/SpanTree";
import {
  formatCost,
  formatDuration,
  formatValue,
  toggleSpanCollapse,
} from "@/features/debug/components/span-tree-helpers";
import { TraceStatusBadge } from "@/features/debug/components/TraceStatusBadge";
import { useTraceStore } from "@/features/debug/stores/traceStore";
import { cn } from "@/utils/cn";

export default function TraceDetailPage() {
  const params = useParams();
  // SAFETY: Next.js route parameter matches [traceId] single slug segment
  const traceId = params?.traceId as string | undefined;

  const traces = useTraceStore((state) => state.traces);

  const trace = useMemo(() => {
    return traces.find((t) => t.id === traceId);
  }, [traces, traceId]);

  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [collapsedSpans, setCollapsedSpans] = useState<Set<string>>(new Set());

  const selectedSpan = useMemo(() => {
    if (!trace) return null;

    if (selectedSpanId) {
      return trace.spans.find((s) => s.id === selectedSpanId) || null;
    }

    return trace.spans[0] || null;
  }, [trace, selectedSpanId]);

  if (!trace) {
    return (
      <div role="status" className="flex flex-col items-center justify-center h-[60vh] space-y-4 font-sans">
        <AlertCircle className="h-10 w-10 text-muted" aria-hidden="true" />
        <div className="text-center">
          <h1 className="text-sm font-semibold text-foreground">Trace not found</h1>
          <p className="text-xs text-muted mt-1">This execution run might have been cleared or doesn't exist.</p>
        </div>
        <Link
          href="/traces"
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-sm text-xs font-semibold shadow-md transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Traces</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 font-sans animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <Link
          href="/traces"
          aria-label="Back to traces"
          className="p-1.5 rounded-sm border border-border hover:bg-surface text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted font-mono min-w-0">
          <Link href="/traces" className="hover:text-accent transition-colors">
            TRACES
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-foreground truncate max-w-xs">
            {trace.name}
          </span>
        </nav>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-md bg-elevated border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold font-display tracking-tight text-foreground">{trace.name}</h1>
            <TraceStatusBadge status={trace.status} />
          </div>
          <p className="text-xs text-muted font-mono truncate">Trace ID: {trace.id}</p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs border-t lg:border-t-0 pt-4 lg:pt-0 border-border font-mono">
          <div className="space-y-0.5">
            <div className="text-2xs text-muted uppercase font-extrabold">Latency</div>
            <div className="flex items-center gap-1 text-foreground font-bold">
              <Clock className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              <span>{formatDuration(trace.durationMs)}</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xs text-muted uppercase font-extrabold">Total Tokens</div>
            <div className="flex items-center gap-1 text-foreground font-bold">
              <Cpu className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              <span>{trace.totalTokens.toLocaleString()}</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xs text-muted uppercase font-extrabold">Tokens Split</div>
            <div className="text-muted font-medium">
              in: {trace.promptTokens} | out: {trace.completionTokens}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-2xs text-muted uppercase font-extrabold">Est. Cost</div>
            <div className="flex items-center gap-1 text-foreground font-bold">
              <Coins className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              <span>{formatCost(trace.costUsd)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-5 p-4 rounded-md bg-elevated border border-border shadow-sm flex flex-col min-h-[500px]">
          <h2 className="text-2xs font-extrabold uppercase tracking-wider text-muted border-b border-border pb-2 mb-3">
            Execution Timeline & Span Tree
          </h2>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-[500px] min-h-0 font-mono text-xs">
            <SpanTree
              spans={trace.spans}
              selectedSpanId={selectedSpan?.id ?? null}
              onSelectSpan={setSelectedSpanId}
              collapsedSpans={collapsedSpans}
              onToggleCollapse={(spanId) => setCollapsedSpans((prev) => toggleSpanCollapse(spanId, prev))}
              emptyMessage="No nested spans captured."
            />
          </div>
        </div>

        <div className="lg:col-span-7 p-4 rounded-md bg-elevated border border-border shadow-sm flex flex-col min-h-[500px]">
          <h2 className="text-2xs font-extrabold uppercase tracking-wider text-muted border-b border-border pb-2 mb-3">
            Span Parameters & Detail Inspector
          </h2>

          {selectedSpan ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground font-display">{selectedSpan.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 font-mono text-2xs text-muted">
                    <span className="px-1.5 py-0.5 rounded-sm bg-surface-hover border border-border">
                      TYPE: {selectedSpan.type.toUpperCase()}
                    </span>
                    <span aria-hidden="true">•</span>
                    <span>STATUS: {selectedSpan.status.toUpperCase()}</span>
                    <span aria-hidden="true">•</span>
                    <span>DURATION: {formatDuration(selectedSpan.durationMs)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {selectedSpan.endTime && (
                    <span className="text-2xs text-muted font-mono">
                      Started: {new Date(selectedSpan.startTime).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>

              {selectedSpan.input !== undefined && (
                <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between text-2xs font-extrabold uppercase text-muted">
                    <span>Input / Parameters</span>
                    <CopyButton
                      text={formatValue(selectedSpan.input)}
                      label="Copy Input"
                      className="px-2 py-0.5 rounded-sm bg-surface-hover hover:bg-border text-2xs border border-border"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[160px] min-h-0">
                    <pre className="p-3 bg-surface border border-border rounded-md text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                      {formatValue(selectedSpan.input)}
                    </pre>
                  </div>
                </div>
              )}

              {selectedSpan.output !== undefined && (
                <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between text-2xs font-extrabold uppercase text-muted">
                    <span>Output / Observation</span>
                    <CopyButton
                      text={formatValue(selectedSpan.output)}
                      label="Copy Output"
                      className="px-2 py-0.5 rounded-sm bg-surface-hover hover:bg-border text-2xs border border-border"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[220px] min-h-0">
                    <pre className="p-3 bg-surface border border-border rounded-md text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                      {formatValue(selectedSpan.output)}
                    </pre>
                  </div>
                </div>
              )}

              {selectedSpan.metadata && Object.keys(selectedSpan.metadata).length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-2xs font-extrabold uppercase text-muted">Metadata</div>
                  <pre className="p-3 bg-surface border border-border rounded-md text-xs font-mono text-foreground overflow-x-auto">
                    {JSON.stringify(selectedSpan.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-muted">
              Select a span in the tree timeline to inspect.
            </div>
          )}
        </div>
      </div>

      <div className="p-5 rounded-md bg-elevated border border-border shadow-sm space-y-4">
        <div>
          <h2 className="text-2xs font-extrabold uppercase tracking-wider text-muted">
            Duration Distribution (Usage Chart)
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Visualization of task segments relative to total run execution latency.
          </p>
        </div>

        <div className="space-y-3.5">
          {trace.spans
            .filter(
              (s) => s.type === "tool" || s.type === "subagent" || s.type === "thought" || s.type === "file_operation",
            )
            .map((span) => {
              const pct = trace.durationMs > 0 ? (span.durationMs / trace.durationMs) * 100 : 0;
              const barWidth = Math.max(1, Math.min(100, pct));

              return (
                <div key={span.id} className="space-y-1 font-mono text-xs">
                  <div className="flex items-center justify-between text-muted">
                    <span className="font-semibold truncate max-w-sm flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          span.type === "thought" && "bg-success",
                          span.type === "tool" && "bg-primary",
                          span.type === "subagent" && "bg-primary",
                          span.type === "file_operation" && "bg-primary",
                        )}
                      />
                      {span.name}
                    </span>
                    <span className="font-bold">
                      {formatDuration(span.durationMs)} ({pct.toFixed(1)}%)
                    </span>
                  </div>

                  <div
                    className="h-2 w-full rounded-full bg-surface-hover border border-border overflow-hidden"
                    aria-hidden="true"
                  >
                    <div
                      style={{ width: `${barWidth}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        span.type === "thought" && "bg-success/80",
                        span.type === "tool" && "bg-accent/80",
                        span.type === "subagent" && "bg-accent/80",
                        span.type === "file_operation" && "bg-accent/80",
                      )}
                    />
                  </div>
                </div>
              );
            })}
          {trace.spans.filter(
            (s) => s.type === "tool" || s.type === "subagent" || s.type === "thought" || s.type === "file_operation",
          ).length === 0 && (
            <div className="text-center py-5 text-xs text-muted">
              No chart-compatible spans (tools, thoughts, subagents) found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
