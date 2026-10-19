"use client";

import { Activity, ArrowRight, Clock, Coins, Cpu, Filter, type LucideIcon, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { formatCost, formatDuration } from "@/features/debug/components/span-tree-helpers";
import { TraceStatusBadge } from "@/features/debug/components/TraceStatusBadge";
import { useTraceStore } from "@/features/debug/stores/traceStore";
import { cn } from "@/utils/cn";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
}

function MetricCard({ label, value, icon }: MetricCardProps) {
  return (
    <div className="p-4 rounded-md bg-elevated border border-border shadow-sm flex flex-col justify-between h-24">
      <div className="flex items-center justify-between text-muted">
        <span className="text-2xs font-extrabold uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <span className="mt-2 text-2xl font-bold font-display tracking-tight text-foreground">{value}</span>
    </div>
  );
}

function MetricIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="h-4 w-4" aria-hidden="true" />;
}

function ActivityDot({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2 w-2" aria-hidden="true">
      <span
        className={cn(
          "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
          active ? "bg-success" : "bg-border-strong",
        )}
      />
      <span className={cn("relative inline-flex rounded-full h-2 w-2", active ? "bg-success" : "bg-subtle")} />
    </span>
  );
}

export default function TracesPage() {
  const traces = useTraceStore((state) => state.traces);
  const clearTraces = useTraceStore((state) => state.clearTraces);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");

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

  const models = useMemo(() => {
    const set = new Set<string>();

    for (const t of traces) {
      if (t.model) {
        set.add(t.model);
      }
    }

    return Array.from(set);
  }, [traces]);

  const filteredTraces = useMemo(() => {
    return traces.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.sessionTitle?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || t.status === statusFilter;

      const matchesModel = modelFilter === "all" || t.model === modelFilter;

      return matchesSearch && matchesStatus && matchesModel;
    });
  }, [traces, search, statusFilter, modelFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-accent/10 border border-accent/20 text-accent">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold font-display uppercase tracking-wider text-foreground">
              Agent Telemetry & Traces
            </h1>
          </div>
          <p className="text-xs text-muted mt-1">
            Analyze execution runs, tool invocations, latencies, and costs in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {traces.length > 0 && (
            <button
              type="button"
              onClick={clearTraces}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-elevated text-xs text-muted hover:bg-surface hover:text-danger transition-all cursor-pointer shadow-sm"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Runs" value={stats.totalTraces} icon={<MetricIcon icon={Activity} />} />
        <MetricCard
          label="Active Stream"
          value={stats.activeCount}
          icon={<ActivityDot active={stats.activeCount > 0} />}
        />
        <MetricCard label="Total Tokens" value={stats.totalTokens.toLocaleString()} icon={<MetricIcon icon={Cpu} />} />
        <MetricCard label="Estimated Cost" value={formatCost(stats.totalCost)} icon={<MetricIcon icon={Coins} />} />
      </div>

      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-surface border border-border p-3 rounded-md shrink-0">
        <div className="relative flex-1">
          <Search
            className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search traces"
            placeholder="Search by trace name, session title or run ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-elevated border border-border rounded-md pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
            <Filter className="h-3 w-3 text-muted" aria-hidden="true" />
            <select
              value={statusFilter}
              aria-label="Filter by status"
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent border-0 text-xs text-foreground font-medium focus:outline-none cursor-pointer py-1 pr-1"
            >
              <option value="all">All Statuses</option>
              <option value="streaming">Streaming</option>
              <option value="complete">Complete</option>
              <option value="interrupted">Interrupted</option>
              <option value="error">Error</option>
            </select>
          </div>

          {models.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
              <Cpu className="h-3 w-3 text-muted" aria-hidden="true" />
              <select
                value={modelFilter}
                aria-label="Filter by model"
                onChange={(e) => setModelFilter(e.target.value)}
                className="bg-transparent border-0 text-xs text-foreground font-medium focus:outline-none cursor-pointer py-1 pr-1"
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

      <div className="bg-elevated border border-border rounded-md overflow-hidden shadow-sm">
        {filteredTraces.length === 0 ? (
          <div role="status" className="text-center py-20 text-xs text-muted space-y-3">
            <Activity className="h-10 w-10 mx-auto text-subtle" aria-hidden="true" />
            {traces.length === 0 ? (
              <div>
                <p className="font-semibold text-foreground">No traces captured yet</p>
                <p className="text-muted mt-1">Start a chat session to stream telemetry runs.</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-foreground">No traces match your filters</p>
                <p className="text-muted mt-1">Adjust the search text, status or model filter.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface text-2xs font-extrabold uppercase tracking-wider text-muted">
                  <th scope="col" className="px-5 py-3">
                    Trace name / Objective
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Latency
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Tokens
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Cost
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Model
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs text-foreground">
                {filteredTraces.map((trace) => {
                  const relativeTime = new Date(trace.startTime).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  const traceModel = trace.model || "—";

                  return (
                    <tr key={trace.id} className="hover:bg-surface transition-colors group">
                      <td className="px-5 py-4 font-medium max-w-md">
                        <Link href={`/traces/${trace.id}`} className="block">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground group-hover:text-accent transition-colors truncate font-display font-bold">
                              {trace.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-2xs text-muted font-mono">
                            <span>ID: {trace.id.slice(0, 8)}...</span>
                            {trace.sessionTitle && (
                              <>
                                <span aria-hidden="true">•</span>
                                <span className="truncate max-w-xs">{trace.sessionTitle}</span>
                              </>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <TraceStatusBadge status={trace.status} withPulse />
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-xs">
                        <div className="flex items-center gap-1.5 text-muted">
                          <Clock className="h-3 w-3 text-muted" aria-hidden="true" />
                          <span>{formatDuration(trace.durationMs)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-xs">
                        <div className="text-foreground font-bold">{trace.totalTokens.toLocaleString()}</div>
                        <div className="text-2xs text-muted mt-0.5">
                          in: {trace.promptTokens} | out: {trace.completionTokens}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-xs font-semibold text-foreground">
                        {formatCost(trace.costUsd)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-muted max-w-xs truncate">{traceModel}</td>
                      <td className="px-5 py-4 whitespace-nowrap text-right text-muted font-mono text-xs">
                        <div className="flex items-center justify-end gap-2">
                          <span>{relativeTime}</span>
                          <ArrowRight
                            className="h-3.5 w-3.5 text-subtle group-hover:text-accent group-hover:translate-x-0.5 transition-all"
                            aria-hidden="true"
                          />
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
