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
import { useTraceStore } from "@/features/debug/stores/traceStore";
import { cn } from "@/utils/cn";

export default function TraceDetailPage() {
  const params = useParams();
  const traceId = params?.traceId as string | undefined;

  const traces = useTraceStore((state) => state.traces);
  const trace = useMemo(() => {
    return traces.find((t) => t.id === traceId);
  }, [traces, traceId]);

  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [collapsedSpans, setCollapsedSpans] = useState<Set<string>>(new Set());

  // Selected span detail query
  const selectedSpan = useMemo(() => {
    if (!trace) return null;
    if (selectedSpanId) {
      return trace.spans.find((s) => s.id === selectedSpanId) || null;
    }
    // Default to the first span
    return trace.spans[0] || null;
  }, [trace, selectedSpanId]);

  if (!trace) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 font-sans select-none">
        <AlertCircle className="h-10 w-10 text-zinc-400 dark:text-zinc-600 animate-pulse" />
        <div className="text-center">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Trace not found</h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
            This execution run might have been cleared or doesn't exist.
          </p>
        </div>
        <Link
          href="/traces"
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-full text-xs font-semibold shadow-md active:scale-98 transition-all cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Traces</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 font-sans select-none animate-in fade-in duration-300">
      {/* Header Back Button & Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/traces"
          className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 font-mono">
          <Link href="/traces" className="hover:text-purple-500 transition-colors">
            TRACES
          </Link>
          <span>/</span>
          <span className="text-zinc-600 dark:text-zinc-400 truncate max-w-xs">{trace.name}</span>
        </div>
      </div>

      {/* Trace Overview Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold font-display tracking-tight text-zinc-950 dark:text-white">
              {trace.name}
            </h1>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border",
                trace.status === "streaming" &&
                  "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
                trace.status === "complete" &&
                  "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
                trace.status === "error" && "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
                trace.status === "interrupted" &&
                  "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
              )}
            >
              {trace.status}
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate">Trace ID: {trace.id}</p>
        </div>

        {/* Banner Metrics */}
        <div className="flex flex-wrap items-center gap-6 text-xs border-t lg:border-t-0 pt-4 lg:pt-0 border-zinc-100 dark:border-zinc-900 font-mono">
          <div className="space-y-0.5">
            <div className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-extrabold">Latency</div>
            <div className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200 font-bold">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              <span>{formatDuration(trace.durationMs)}</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-extrabold">Total Tokens</div>
            <div className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200 font-bold">
              <Cpu className="h-3.5 w-3.5 text-zinc-400" />
              <span>{trace.totalTokens.toLocaleString()}</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-extrabold">Tokens Split</div>
            <div className="text-zinc-500 dark:text-zinc-400 font-medium">
              in: {trace.promptTokens} | out: {trace.completionTokens}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-extrabold">Est. Cost</div>
            <div className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200 font-bold">
              <Coins className="h-3.5 w-3.5 text-zinc-400" />
              <span>{formatCost(trace.costUsd)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main split tree & detail panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Side: Span Tree */}
        <div className="lg:col-span-5 p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex flex-col min-h-[500px]">
          <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-900 pb-2 mb-3">
            Execution Timeline & Span Tree
          </h3>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-[500px] min-h-0 font-mono text-[11px]">
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

        {/* Right Side: Span Detail Panel */}
        <div className="lg:col-span-7 p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex flex-col min-h-[500px]">
          <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-900 pb-2 mb-3">
            Span Parameters & Detail Inspector
          </h3>

          {selectedSpan ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-4">
              {/* Span Title Info */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white font-display">{selectedSpan.name}</h4>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 font-mono text-[9px] text-zinc-400 dark:text-zinc-500">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                      TYPE: {selectedSpan.type.toUpperCase()}
                    </span>
                    <span>•</span>
                    <span>STATUS: {selectedSpan.status.toUpperCase()}</span>
                    <span>•</span>
                    <span>DURATION: {formatDuration(selectedSpan.durationMs)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {selectedSpan.endTime && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                      Started: {new Date(selectedSpan.startTime).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>

              {/* JSON Input / Instructions */}
              {selectedSpan.input !== undefined && (
                <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between text-[10px] font-extrabold uppercase text-zinc-400 dark:text-zinc-500">
                    <span>Input / Parameters</span>
                    <CopyButton
                      text={formatValue(selectedSpan.input)}
                      label="Copy Input"
                      className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-[10px] border border-zinc-200 dark:border-zinc-800"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[160px] min-h-0">
                    <pre className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl text-[10px] font-mono text-zinc-800 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                      {formatValue(selectedSpan.input)}
                    </pre>
                  </div>
                </div>
              )}

              {/* JSON Output / Results */}
              {selectedSpan.output !== undefined && (
                <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
                  <div className="flex items-center justify-between text-[10px] font-extrabold uppercase text-zinc-400 dark:text-zinc-500">
                    <span>Output / Observation</span>
                    <CopyButton
                      text={formatValue(selectedSpan.output)}
                      label="Copy Output"
                      className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-[10px] border border-zinc-200 dark:border-zinc-800"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[220px] min-h-0">
                    <pre className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl text-[10px] font-mono text-zinc-800 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                      {formatValue(selectedSpan.output)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Span Metadata */}
              {selectedSpan.metadata && Object.keys(selectedSpan.metadata).length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-extrabold uppercase text-zinc-400 dark:text-zinc-500">Metadata</div>
                  <pre className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl text-[10px] font-mono text-zinc-800 dark:text-zinc-300 overflow-x-auto">
                    {JSON.stringify(selectedSpan.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-zinc-400 dark:text-zinc-500">
              Select a span in the tree timeline to inspect.
            </div>
          )}
        </div>
      </div>

      {/* Usage & Cost Distribution Chart Panel */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm space-y-4">
        <div>
          <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Duration Distribution (Usage Chart)
          </h3>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            Visualization of task segments relative to total run execution latency.
          </p>
        </div>

        {/* Chart Bars */}
        <div className="space-y-3.5">
          {trace.spans
            .filter(
              (s) => s.type === "tool" || s.type === "subagent" || s.type === "thought" || s.type === "file_operation",
            )
            .map((span) => {
              const pct = trace.durationMs > 0 ? (span.durationMs / trace.durationMs) * 100 : 0;
              const barWidth = Math.max(1, Math.min(100, pct));

              return (
                <div key={span.id} className="space-y-1 font-mono text-[10px]">
                  <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold truncate max-w-sm flex items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          span.type === "thought" && "bg-emerald-500",
                          span.type === "tool" && "bg-purple-500",
                          span.type === "subagent" && "bg-indigo-500",
                          span.type === "file_operation" && "bg-blue-500",
                        )}
                      />
                      {span.name}
                    </span>
                    <span className="font-bold">
                      {formatDuration(span.durationMs)} ({pct.toFixed(1)}%)
                    </span>
                  </div>

                  {/* Horizontal CSS Bar */}
                  <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/30 dark:border-zinc-800 overflow-hidden">
                    <div
                      style={{ width: `${barWidth}%` }}
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        span.type === "thought" && "bg-emerald-500/80 dark:bg-emerald-400/80",
                        span.type === "tool" && "bg-purple-500/80 dark:bg-purple-400/80",
                        span.type === "subagent" && "bg-indigo-500/80 dark:bg-indigo-400/80",
                        span.type === "file_operation" && "bg-blue-500/80 dark:bg-blue-400/80",
                      )}
                    />
                  </div>
                </div>
              );
            })}
          {trace.spans.filter(
            (s) => s.type === "tool" || s.type === "subagent" || s.type === "thought" || s.type === "file_operation",
          ).length === 0 && (
            <div className="text-center py-5 text-xs text-zinc-400 dark:text-zinc-500">
              No chart-compatible spans (tools, thoughts, subagents) found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
