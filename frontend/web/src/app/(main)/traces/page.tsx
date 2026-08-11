"use client";

import { Activity, ArrowRight, Clock, Coins, Cpu, Filter, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTraceStore } from "@/features/debug/stores/traceStore";
import { cn } from "@/utils/cn";

export default function TracesPage() {
  const traces = useTraceStore((state) => state.traces);
  const clearTraces = useTraceStore((state) => state.clearTraces);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");

  // Calculate high-level stats
  const stats = useMemo(() => {
    let totalCost = 0;
    let totalTokens = 0;
    let activeCount = 0;

    for (const t of traces) {
      totalCost += t.costUsd || 0;
      totalTokens += t.totalTokens || 0;
      if (t.status === "streaming") {
        activeCount++;
      }
    }

    return {
      totalTraces: traces.length,
      totalCost,
      totalTokens,
      activeCount,
    };
  }, [traces]);

  // Extract unique models for filtering
  const models = useMemo(() => {
    const set = new Set<string>();
    for (const t of traces) {
      if (t.metadata?.model) {
        set.add(t.metadata.model as string);
      }
    }
    return Array.from(set);
  }, [traces]);

  // Apply filters
  const filteredTraces = useMemo(() => {
    return traces.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.sessionTitle?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || t.status === statusFilter;

      const matchesModel = modelFilter === "all" || t.metadata?.model === modelFilter;

      return matchesSearch && matchesStatus && matchesModel;
    });
  }, [traces, search, statusFilter, modelFilter]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatCost = (cost: number) => {
    if (cost === 0) return "$0.00";
    if (cost < 0.001) return `$${cost.toFixed(5)}`;
    return `$${cost.toFixed(4)}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans select-none animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <Activity className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold font-display uppercase tracking-wider text-zinc-900 dark:text-zinc-50">
              Agent Telemetry & Traces
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Analyze execution runs, tool invocations, latencies, and costs in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {traces.length > 0 && (
            <button
              type="button"
              onClick={clearTraces}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-red-600 dark:hover:text-red-400 transition-all cursor-pointer shadow-sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Traces */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between h-24">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Runs</span>
            <Activity className="h-4 w-4" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-display tracking-tight text-zinc-950 dark:text-white">
              {stats.totalTraces}
            </span>
          </div>
        </div>

        {/* Active Runs */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between h-24">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Active Stream</span>
            <div className="relative flex h-2 w-2">
              <span
                className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  stats.activeCount > 0 ? "bg-green-400" : "bg-zinc-400",
                )}
              />
              <span
                className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  stats.activeCount > 0 ? "bg-green-500" : "bg-zinc-500",
                )}
              />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-display tracking-tight text-zinc-950 dark:text-white">
              {stats.activeCount}
            </span>
          </div>
        </div>

        {/* Cumulative Tokens */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between h-24">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Total Tokens</span>
            <Cpu className="h-4 w-4" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-display tracking-tight text-zinc-950 dark:text-white">
              {stats.totalTokens.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Estimated Cost */}
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm flex flex-col justify-between h-24">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Estimated Cost</span>
            <Coins className="h-4 w-4" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-display tracking-tight text-zinc-950 dark:text-white">
              {formatCost(stats.totalCost)}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60 p-3 rounded-2xl shrink-0">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-3 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by trace name, session title or run ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1">
            <Filter className="h-3 w-3 text-zinc-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-0 text-[11px] text-zinc-700 dark:text-zinc-300 font-medium focus:outline-none cursor-pointer py-1 pr-1"
            >
              <option value="all">All Statuses</option>
              <option value="streaming">Streaming</option>
              <option value="complete">Complete</option>
              <option value="interrupted">Interrupted</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Model Filter */}
          {models.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1">
              <Cpu className="h-3 w-3 text-zinc-400" />
              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="bg-transparent border-0 text-[11px] text-zinc-700 dark:text-zinc-300 font-medium focus:outline-none cursor-pointer py-1 pr-1"
              >
                <option value="all">All Models</option>
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Traces Table / Grid */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
        {filteredTraces.length === 0 ? (
          <div className="text-center py-20 text-xs text-zinc-400 dark:text-zinc-500 space-y-3">
            <Activity className="h-10 w-10 mx-auto text-zinc-300 dark:text-zinc-800 animate-pulse" />
            <div>
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">No traces captured yet</p>
              <p className="text-zinc-400 dark:text-zinc-600 mt-1">Start a chat session to stream telemetry runs.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  <th className="px-5 py-3">Trace name / Objective</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Latency</th>
                  <th className="px-5 py-3">Tokens</th>
                  <th className="px-5 py-3">Cost</th>
                  <th className="px-5 py-3">Model</th>
                  <th className="px-5 py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 text-xs text-zinc-700 dark:text-zinc-300">
                {filteredTraces.map((trace) => {
                  const relativeTime = new Date(trace.startTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <tr
                      key={trace.id}
                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors group cursor-pointer"
                    >
                      <td className="px-5 py-4 font-medium max-w-md">
                        <Link href={`/traces/${trace.id}`} className="block">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate font-display font-bold">
                              {trace.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                            <span>ID: {trace.id.slice(0, 8)}...</span>
                            {trace.sessionTitle && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-xs">{trace.sessionTitle}</span>
                              </>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border",
                            trace.status === "streaming" &&
                              "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
                            trace.status === "complete" &&
                              "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
                            trace.status === "error" &&
                              "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
                            trace.status === "interrupted" &&
                              "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
                          )}
                        >
                          {trace.status === "streaming" && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                            </span>
                          )}
                          {trace.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-[11px]">
                        <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                          <Clock className="h-3 w-3 text-zinc-400" />
                          <span>{formatDuration(trace.durationMs)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-[11px]">
                        <div className="text-zinc-800 dark:text-zinc-300 font-bold">
                          {trace.totalTokens.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                          in: {trace.promptTokens} | out: {trace.completionTokens}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-300">
                        {formatCost(trace.costUsd)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-zinc-500 dark:text-zinc-400 max-w-xs truncate">
                        {(trace.metadata?.model as string) || trace.model || "—"}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right text-zinc-400 dark:text-zinc-500 font-mono text-[10px]">
                        <div className="flex items-center justify-end gap-2">
                          <span>{relativeTime}</span>
                          <Link href={`/traces/${trace.id}`}>
                            <ArrowRight className="h-3.5 w-3.5 text-zinc-300 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
