"use client";

import React from "react";
import { ShieldCheck, RefreshCw, Server, Cpu, Activity } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/utils/cn";

export interface SystemStatusBannerProps {
  isOperational?: boolean;
  latencyMs?: number;
  lastUpdated?: number;
  onRefresh?: () => void;
  isRefetching?: boolean;
}

export function SystemStatusBanner({
  isOperational = true,
  latencyMs = 12,
  lastUpdated,
  onRefresh,
  isRefetching = false,
}: SystemStatusBannerProps) {
  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div className="p-5 border border-zinc-800/80 bg-zinc-900/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 bottom-0 w-1/3 bg-gradient-to-l from-emerald-500/5 to-transparent pointer-events-none" />

      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shrink-0 mt-0.5 md:mt-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h4 className="text-sm font-semibold text-zinc-100 tracking-tight">
              System Gateway Operational
            </h4>
            <Badge variant="success" className="gap-1.5 py-0.5 text-[11px]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Active Cluster
            </Badge>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
            All background agent routines, task dispatchers, and Redis instances are running normally. Average memory latency is currently <span className="text-zinc-200 font-medium">{latencyMs}ms</span>.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-800/60">
        <div className="hidden lg:flex items-center gap-4 text-xs text-zinc-400 mr-2">
          <div className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-zinc-500" />
            <span>Nodes: 3/3</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-zinc-500" />
            <span>Uptime: 99.9%</span>
          </div>
        </div>

        {formattedTime && (
          <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
            Updated {formattedTime}
          </span>
        )}

        {onRefresh && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={isRefetching}
            className="gap-2 text-xs h-8 px-3"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin text-blue-400")} />
            <span>{isRefetching ? "Refreshing..." : "Refresh"}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
