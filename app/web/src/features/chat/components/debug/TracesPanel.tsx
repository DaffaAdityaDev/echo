"use client";

import { Activity, ArrowLeft, Clock, Coins, Cpu, Filter, Search, Trash2 } from "lucide-react";
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

export function TracesPanel() {
  const traces = useTraceStore((state) => state.traces);
  const clearTraces = useTraceStore((state) => state.clearTraces);

  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [collapsedSpans, setCollapsedSpans] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const trace = useMemo(() => {
    return traces.find((t) => t.id === selectedTraceId);
  }, [traces, selectedTraceId]);

  const filteredTraces = useMemo(() => {
    return traces.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || t.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [traces, search, statusFilter]);

  const selectedSpan = useMemo(() => {
    if (!trace) return null;

    if (selectedSpanId) {
      return trace.spans.find((s) => s.id === selectedSpanId) || null;
    }

    return trace.spans[0] || null;
  }, [trace, selectedSpanId]);

  const handleSelectTrace = (id: string) => {
    setSelectedTraceId(id);
    setSelectedSpanId(null);
    setCollapsedSpans(new Set());
  };

  if (!trace) {
    return (
      <div className="flex flex-col h-full space-y-3 font-sans">
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search
              className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search traces"
              placeholder="Search traces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-hover border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-hover px-2 py-1.5 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
            <Filter className="h-3 w-3 text-muted" aria-hidden="true" />
            <select
              value={statusFilter}
              aria-label="Filter by status"
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-0 text-xs text-foreground font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">All</option>
              <option value="streaming">Streaming</option>
              <option value="complete">Complete</option>
              <option value="error">Error</option>
            </select>
          </div>
          {traces.length > 0 && (
            <button
              type="button"
              onClick={clearTraces}
              className="p-2 rounded-sm border border-border text-muted hover:text-danger transition-colors cursor-pointer"
              aria-label="Clear traces"
              title="Clear traces"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
          {filteredTraces.length === 0 ? (
            <div role="status" className="text-center py-20 text-xs text-muted space-y-2">
              <Activity className="h-8 w-8 mx-auto text-subtle" aria-hidden="true" />
              <p>{traces.length === 0 ? "No traces captured yet." : "No traces match your filters."}</p>
            </div>
          ) : (
            filteredTraces.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTrace(t.id)}
                className="w-full text-left p-3 bg-surface border border-border rounded-md hover:border-accent/40 hover:bg-surface-hover cursor-pointer transition-colors flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs text-foreground truncate font-display">{t.name}</span>
                  <TraceStatusBadge status={t.status} className="px-1.5" />
                </div>

                <div className="flex items-center justify-between text-xs text-muted font-mono">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted" aria-hidden="true" />
                      {formatDuration(t.durationMs)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Cpu className="h-3 w-3 text-muted" aria-hidden="true" />
                      {t.totalTokens.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3 text-muted" aria-hidden="true" />
                      {formatCost(t.costUsd)}
                    </span>
                  </div>
                  <span>{new Date(t.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 font-sans min-h-0">
      <div className="flex items-center justify-between gap-3 shrink-0 border-b border-border pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setSelectedTraceId(null)}
            aria-label="Back to trace list"
            className="p-1.5 rounded-sm border border-border hover:bg-surface-hover text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h3 className="font-bold text-xs text-foreground font-display truncate">{trace.name}</h3>
            <div className="flex items-center gap-2 text-xs text-muted font-mono">
              <span>{formatDuration(trace.durationMs)}</span>
              <span aria-hidden="true">•</span>
              <span>{formatCost(trace.costUsd)}</span>
            </div>
          </div>
        </div>

        <TraceStatusBadge status={trace.status} />
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden">
        <div className="flex-1 border border-border rounded-md p-2.5 overflow-y-auto max-h-[220px] md:max-h-none md:flex-1 min-h-0 font-mono text-xs space-y-0.5 bg-surface">
          <SpanTree
            spans={trace.spans}
            selectedSpanId={selectedSpan?.id ?? null}
            onSelectSpan={setSelectedSpanId}
            collapsedSpans={collapsedSpans}
            onToggleCollapse={(spanId) => setCollapsedSpans((prev) => toggleSpanCollapse(spanId, prev))}
            compact
          />
        </div>

        <div className="flex-1 border border-border rounded-md p-3 flex flex-col min-h-0 bg-surface overflow-y-auto">
          {selectedSpan ? (
            <div className="space-y-3.5 flex flex-col h-full min-h-0">
              <div>
                <h4 className="font-bold text-xs text-foreground font-display">{selectedSpan.name}</h4>
                <div className="flex flex-wrap items-center gap-1.5 mt-1 font-mono text-2xs text-muted">
                  <span className="px-1.5 py-0.5 rounded-sm bg-surface-hover border border-border">
                    {selectedSpan.type.toUpperCase()}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span>{selectedSpan.status.toUpperCase()}</span>
                  <span aria-hidden="true">•</span>
                  <span>{formatDuration(selectedSpan.durationMs)}</span>
                </div>
              </div>

              {selectedSpan.input !== undefined && (
                <div className="space-y-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between text-2xs font-extrabold uppercase text-muted">
                    <span>Input</span>
                    <CopyButton
                      text={formatValue(selectedSpan.input)}
                      label="Copy"
                      title="Copy input"
                      className="px-1.5 py-0.5 rounded-sm bg-surface-hover hover:bg-border text-2xs border border-border"
                    />
                  </div>
                  <pre className="p-2.5 bg-surface-hover border border-border rounded-md text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap max-h-[100px]">
                    {formatValue(selectedSpan.input)}
                  </pre>
                </div>
              )}

              {selectedSpan.output !== undefined && (
                <div className="space-y-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between text-2xs font-extrabold uppercase text-muted">
                    <span>Output</span>
                    <CopyButton
                      text={formatValue(selectedSpan.output)}
                      label="Copy"
                      title="Copy output"
                      className="px-1.5 py-0.5 rounded-sm bg-surface-hover hover:bg-border text-2xs border border-border"
                    />
                  </div>
                  <pre className="p-2.5 bg-surface-hover border border-border rounded-md text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap max-h-[140px]">
                    {formatValue(selectedSpan.output)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-muted">Select a span to inspect.</div>
          )}
        </div>
      </div>
    </div>
  );
}
