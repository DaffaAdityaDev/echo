"use client";

import {
  AlertCircle,
  ArrowLeft,
  Brain,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  FileCode,
  Info,
  Network,
  Terminal,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { type Span, useTraceStore } from "@/features/debug/stores/traceStore";
import { cn } from "@/utils/cn";

interface TreeSpanNode {
  span: Span;
  children: TreeSpanNode[];
  depth: number;
}

export default function TraceDetailPage() {
  const params = useParams();
  const traceId = params?.traceId as string | undefined;

  const traces = useTraceStore((state) => state.traces);
  const trace = useMemo(() => {
    return traces.find((t) => t.id === traceId);
  }, [traces, traceId]);

  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [collapsedSpans, setCollapsedSpans] = useState<Set<string>>(new Set());

  // Build the nested span tree hierarchy
  const spanTree = useMemo(() => {
    if (!trace?.spans) return [];

    const nodeMap = new Map<string, TreeSpanNode>();
    const roots: TreeSpanNode[] = [];

    // Initialize nodes
    for (const span of trace.spans) {
      nodeMap.set(span.id, { span, children: [], depth: 0 });
    }

    // Link parents to children
    for (const span of trace.spans) {
      const node = nodeMap.get(span.id);
      if (!node) continue;
      if (span.parentId && nodeMap.has(span.parentId)) {
        const parentNode = nodeMap.get(span.parentId);
        if (parentNode) {
          parentNode.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    // DFS compute depths
    const computeDepth = (node: TreeSpanNode, depth: number) => {
      node.depth = depth;
      // Sort children by startTime to maintain sequential order
      node.children.sort((a, b) => a.span.startTime - b.span.startTime);
      for (const child of node.children) {
        computeDepth(child, depth + 1);
      }
    };

    for (const root of roots) {
      computeDepth(root, 0);
    }

    // Sort roots by startTime
    roots.sort((a, b) => a.span.startTime - b.span.startTime);
    return roots;
  }, [trace]);

  // Flatten the tree for rendering, respecting collapse states
  const visibleNodes = useMemo(() => {
    const list: { node: TreeSpanNode; hasChildren: boolean }[] = [];

    const traverse = (node: TreeSpanNode) => {
      const hasChildren = node.children.length > 0;
      list.push({ node, hasChildren });

      const isCollapsed = collapsedSpans.has(node.span.id);
      if (!isCollapsed) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    for (const root of spanTree) {
      traverse(root);
    }

    return list;
  }, [spanTree, collapsedSpans]);

  // Selected span detail query
  const selectedSpan = useMemo(() => {
    if (!trace) return null;
    if (selectedSpanId) {
      return trace.spans.find((s) => s.id === selectedSpanId) || null;
    }
    // Default to the first span
    return trace.spans[0] || null;
  }, [trace, selectedSpanId]);

  // Collapse/Expand toggles
  const toggleCollapse = (spanId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedSpans((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) {
        next.delete(spanId);
      } else {
        next.add(spanId);
      }
      return next;
    });
  };

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

  // Icons per Type Helper
  const getSpanIcon = (type: Span["type"]) => {
    switch (type) {
      case "thought":
        return <Brain className="h-3.5 w-3.5" />;
      case "tool":
        return <Wrench className="h-3.5 w-3.5" />;
      case "subagent":
        return <Users className="h-3.5 w-3.5" />;
      case "file_operation":
        return <FileCode className="h-3.5 w-3.5" />;
      case "swarm_status":
        return <Network className="h-3.5 w-3.5" />;
      case "todo":
        return <CheckSquare className="h-3.5 w-3.5" />;
      case "error":
        return <AlertCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />;
      case "info":
        return <Info className="h-3.5 w-3.5" />;
      default:
        return <Terminal className="h-3.5 w-3.5" />;
    }
  };

  const getSpanColorClass = (span: Span) => {
    if (span.status === "failed") return "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400";
    if (span.status === "skipped")
      return "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
    if (span.status === "streaming") return "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400";

    // completed colors based on type
    switch (span.type) {
      case "thought":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400";
      case "tool":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400";
      case "subagent":
        return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400";
      case "file_operation":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400";
      case "swarm_status":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400";
      default:
        return "bg-zinc-100 text-zinc-700 border-zinc-200/80 dark:bg-zinc-900/50 dark:text-zinc-300 dark:border-zinc-800/80";
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatCost = (cost: number) => {
    if (cost === 0) return "$0.00";
    if (cost < 0.001) return `$${cost.toFixed(5)}`;
    return `$${cost.toFixed(4)}`;
  };

  const formatValue = (val: unknown) => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "string") return val;
    return JSON.stringify(val, null, 2);
  };

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
            {visibleNodes.length === 0 ? (
              <div className="text-center py-20 text-xs text-zinc-400 dark:text-zinc-500">
                No nested spans captured.
              </div>
            ) : (
              visibleNodes.map(({ node, hasChildren }) => {
                const isSelected = selectedSpan?.id === node.span.id;
                const isCollapsed = collapsedSpans.has(node.span.id);

                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: Tree node navigation
                  // biome-ignore lint/a11y/useKeyWithClickEvents: Tree node navigation
                  <div
                    key={node.span.id}
                    onClick={() => setSelectedSpanId(node.span.id)}
                    style={{ paddingLeft: `${node.depth * 14}px` }}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl border border-transparent cursor-pointer transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/60 select-none group",
                      isSelected
                        ? "bg-purple-500/10 border-purple-500/20 text-purple-950 dark:text-purple-300 font-bold"
                        : "text-zinc-700 dark:text-zinc-300",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Collapse toggle or placeholder spacer */}
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={(e) => toggleCollapse(node.span.id, e)}
                          className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
                        >
                          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      ) : (
                        <div className="w-4" />
                      )}

                      {/* Icon */}
                      <div
                        className={cn(
                          "p-1 rounded-lg border flex items-center justify-center shrink-0 shadow-sm",
                          getSpanColorClass(node.span),
                        )}
                      >
                        {getSpanIcon(node.span.type)}
                      </div>

                      {/* Name */}
                      <span className="truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {node.span.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                      <span>{formatDuration(node.span.durationMs)}</span>
                      {node.span.status === "streaming" && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
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
