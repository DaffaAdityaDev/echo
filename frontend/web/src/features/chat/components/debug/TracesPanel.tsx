"use client";

import {
  Activity,
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
  Filter,
  Info,
  Network,
  Search,
  Terminal,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { type Span, useTraceStore } from "@/features/debug/stores/traceStore";
import { cn } from "@/utils/cn";

interface TreeSpanNode {
  span: Span;
  children: TreeSpanNode[];
  depth: number;
}

export function TracesPanel() {
  const traces = useTraceStore((state) => state.traces);
  const clearTraces = useTraceStore((state) => state.clearTraces);

  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [collapsedSpans, setCollapsedSpans] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Selected Trace
  const trace = useMemo(() => {
    return traces.find((t) => t.id === selectedTraceId);
  }, [traces, selectedTraceId]);

  // Filtered Trace List (for main panel view)
  const filteredTraces = useMemo(() => {
    return traces.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || t.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [traces, search, statusFilter]);

  // Hierarchical Span Tree
  const spanTree = useMemo(() => {
    if (!trace?.spans) return [];

    const nodeMap = new Map<string, TreeSpanNode>();
    const roots: TreeSpanNode[] = [];

    for (const span of trace.spans) {
      nodeMap.set(span.id, { span, children: [], depth: 0 });
    }

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

    const computeDepth = (node: TreeSpanNode, depth: number) => {
      node.depth = depth;
      node.children.sort((a, b) => a.span.startTime - b.span.startTime);
      for (const child of node.children) {
        computeDepth(child, depth + 1);
      }
    };

    for (const root of roots) {
      computeDepth(root, 0);
    }

    roots.sort((a, b) => a.span.startTime - b.span.startTime);
    return roots;
  }, [trace]);

  // Flattened spans for tree rendering
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

  // Selected Span
  const selectedSpan = useMemo(() => {
    if (!trace) return null;
    if (selectedSpanId) {
      return trace.spans.find((s) => s.id === selectedSpanId) || null;
    }
    return trace.spans[0] || null;
  }, [trace, selectedSpanId]);

  // Format Helpers
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

  // Icon Helper
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
        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
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

  const handleSelectTrace = (id: string) => {
    setSelectedTraceId(id);
    setSelectedSpanId(null);
    setCollapsedSpans(new Set());
  };

  // RENDER TRACE LIST VIEW
  if (!trace) {
    return (
      <div className="flex flex-col h-full space-y-3 font-sans">
        {/* Toolbar & Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search traces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-2 py-1.5">
            <Filter className="h-3 w-3 text-zinc-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-0 text-[10px] text-zinc-700 dark:text-zinc-300 font-bold focus:outline-none cursor-pointer"
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
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:text-red-500 transition-colors cursor-pointer"
              title="Clear Traces"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Traces Feed */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
          {filteredTraces.length === 0 ? (
            <div className="text-center py-20 text-xs text-zinc-400 dark:text-zinc-500 space-y-2">
              <Activity className="h-8 w-8 mx-auto text-zinc-300 dark:text-zinc-800 animate-pulse" />
              <p>No traces captured yet.</p>
            </div>
          ) : (
            filteredTraces.map((t) => (
              // biome-ignore lint/a11y/noStaticElementInteractions: Trace list selection
              // biome-ignore lint/a11y/useKeyWithClickEvents: Trace list selection
              <div
                key={t.id}
                onClick={() => handleSelectTrace(t.id)}
                className="p-3 bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl hover:border-purple-500/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 cursor-pointer transition-all flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate max-w-[200px] font-display">
                    {t.name}
                  </span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase border whitespace-nowrap",
                      t.status === "streaming" &&
                        "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
                      t.status === "complete" &&
                        "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
                      t.status === "error" && "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
                      t.status === "interrupted" &&
                        "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
                    )}
                  >
                    {t.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-zinc-400" />
                      {formatDuration(t.durationMs)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Cpu className="h-3 w-3 text-zinc-400" />
                      {t.totalTokens.toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3 text-zinc-400" />
                      {formatCost(t.costUsd)}
                    </span>
                  </div>
                  <span>{new Date(t.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // RENDER TRACE DETAIL TREE & PARAMETERS
  return (
    <div className="flex flex-col h-full space-y-4 font-sans min-h-0">
      {/* Detail Header */}
      <div className="flex items-center justify-between gap-3 shrink-0 border-b border-zinc-200/80 dark:border-zinc-800/80 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setSelectedTraceId(null)}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0">
            <h4 className="font-bold text-xs text-zinc-900 dark:text-white font-display truncate">{trace.name}</h4>
            <div className="flex items-center gap-2 text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
              <span>{formatDuration(trace.durationMs)}</span>
              <span>•</span>
              <span>{formatCost(trace.costUsd)}</span>
            </div>
          </div>
        </div>

        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase border",
            trace.status === "streaming" && "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
            trace.status === "complete" && "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
            trace.status === "error" && "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
          )}
        >
          {trace.status}
        </span>
      </div>

      {/* Main Body: Stacked Tree + Detail Inspector */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden">
        {/* Tree Panel */}
        <div className="flex-1 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-2.5 overflow-y-auto max-h-[220px] md:max-h-none md:flex-1 min-h-0 font-mono text-[10px] space-y-0.5 bg-zinc-50/20 dark:bg-zinc-900/10">
          {visibleNodes.map(({ node, hasChildren }) => {
            const isSelected = selectedSpan?.id === node.span.id;
            const isCollapsed = collapsedSpans.has(node.span.id);

            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: Tree node selection
              // biome-ignore lint/a11y/useKeyWithClickEvents: Tree node selection
              <div
                key={node.span.id}
                onClick={() => setSelectedSpanId(node.span.id)}
                style={{ paddingLeft: `${node.depth * 12}px` }}
                className={cn(
                  "flex items-center justify-between p-1.5 rounded-lg border border-transparent cursor-pointer transition-all hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 select-none group",
                  isSelected
                    ? "bg-purple-500/10 border-purple-500/20 text-purple-950 dark:text-purple-300 font-bold"
                    : "text-zinc-600 dark:text-zinc-400",
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={(e) => toggleCollapse(node.span.id, e)}
                      className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
                    >
                      {isCollapsed ? <ChevronRight className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                    </button>
                  ) : (
                    <div className="w-3.5" />
                  )}

                  <div
                    className={cn(
                      "p-0.5 rounded border flex items-center justify-center shrink-0 shadow-sm",
                      getSpanColorClass(node.span),
                    )}
                  >
                    {getSpanIcon(node.span.type)}
                  </div>

                  <span className="truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {node.span.name}
                  </span>
                </div>

                <span className="text-[8px] text-zinc-400 shrink-0 ml-2">{formatDuration(node.span.durationMs)}</span>
              </div>
            );
          })}
        </div>

        {/* Selected Span Detail Panel */}
        <div className="flex-1 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-3 flex flex-col min-h-0 bg-zinc-50/20 dark:bg-zinc-900/10 overflow-y-auto">
          {selectedSpan ? (
            <div className="space-y-3.5 flex flex-col h-full min-h-0">
              <div>
                <h5 className="font-bold text-xs text-zinc-900 dark:text-white font-display">{selectedSpan.name}</h5>
                <div className="flex flex-wrap items-center gap-1.5 mt-1 font-mono text-[8px] text-zinc-400 dark:text-zinc-500">
                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800">
                    {selectedSpan.type.toUpperCase()}
                  </span>
                  <span>•</span>
                  <span>{selectedSpan.status.toUpperCase()}</span>
                  <span>•</span>
                  <span>{formatDuration(selectedSpan.durationMs)}</span>
                </div>
              </div>

              {selectedSpan.input !== undefined && (
                <div className="space-y-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between text-[9px] font-extrabold uppercase text-zinc-400 dark:text-zinc-500">
                    <span>Input</span>
                    <CopyButton
                      text={formatValue(selectedSpan.input)}
                      label="Copy"
                      className="px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-[8px] border border-zinc-200/60 dark:border-zinc-800"
                    />
                  </div>
                  <pre className="p-2.5 bg-zinc-100/50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl text-[9px] font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-[100px]">
                    {formatValue(selectedSpan.input)}
                  </pre>
                </div>
              )}

              {selectedSpan.output !== undefined && (
                <div className="space-y-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between text-[9px] font-extrabold uppercase text-zinc-400 dark:text-zinc-500">
                    <span>Output</span>
                    <CopyButton
                      text={formatValue(selectedSpan.output)}
                      label="Copy"
                      className="px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-[8px] border border-zinc-200/60 dark:border-zinc-800"
                    />
                  </div>
                  <pre className="p-2.5 bg-zinc-100/50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl text-[9px] font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap max-h-[140px]">
                    {formatValue(selectedSpan.output)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[10px] text-zinc-400 dark:text-zinc-500">
              Select a span to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
