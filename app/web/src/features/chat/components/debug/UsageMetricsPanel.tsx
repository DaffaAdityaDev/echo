"use client";

import { Coins, Gauge, Zap } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";
import { formatCompactNumber } from "@/utils/format";
import { useChatStore } from "../../stores/chatStore";

export function UsageMetricsPanel() {
  const cumulativeUsage = useChatStore((s) => s.cumulativeUsage);

  const promptTokens = cumulativeUsage?.promptTokens || 0;
  const completionTokens = cumulativeUsage?.completionTokens || 0;
  const totalTokens = cumulativeUsage?.totalTokens || 0;
  const cachedTokens = cumulativeUsage?.cachedTokens || 0;
  const reasoningTokens = cumulativeUsage?.reasoningTokens || 0;

  const cacheHitRatio = promptTokens > 0 ? ((cachedTokens / promptTokens) * 100).toFixed(1) : "0.0";
  const nonCachedPromptTokens = Math.max(0, promptTokens - cachedTokens);

  const maxContextWindow = cumulativeUsage?.maxContextTokens || 0;
  const contextUtilization = maxContextWindow > 0 ? ((totalTokens / maxContextWindow) * 100).toFixed(2) : "0.00";
  const contextLabel = formatCompactNumber(maxContextWindow);

  const estimatedCost = (cumulativeUsage?.estimatedCostUsd ?? 0).toFixed(5);

  const inputRatio = promptTokens / Math.max(totalTokens, 1);
  const outputRatio = completionTokens / Math.max(totalTokens, 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-md border border-success/30 bg-success/5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xs font-bold uppercase tracking-wider text-success flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" /> KV Cache Hits / Read
            </span>
            <span className="px-2 py-0.5 rounded-full text-2xs font-extrabold bg-success/15 text-success whitespace-nowrap">
              {cacheHitRatio}% SAVED
            </span>
          </div>
          <div className="text-xl font-extrabold font-mono text-success">
            {cachedTokens.toLocaleString()}{" "}
            <span className="text-xs text-muted font-sans font-normal">/ {promptTokens.toLocaleString()} tokens</span>
          </div>
          <p className="text-xs text-muted">Tokens served directly from KV Prefix Cache (50-80% faster response).</p>
        </div>

        <div className="p-4 rounded-md border border-accent/30 bg-accent/5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" aria-hidden="true" /> Est. Session Cost
            </span>
            <span className="px-2 py-0.5 rounded-full text-2xs font-extrabold bg-accent/15 text-accent font-mono">
              USD
            </span>
          </div>
          <div className="text-xl font-extrabold font-mono text-accent">${estimatedCost}</div>
          <p className="text-xs text-muted">Calculated using active model input, output & cache read rates.</p>
        </div>
      </div>

      <div className="p-5 rounded-md border border-border bg-surface space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-accent" aria-hidden="true" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Context Window & Token Breakdown
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-2xs font-mono font-bold bg-surface-hover border border-border text-foreground">
            {maxContextWindow > 0
              ? `${contextUtilization}% of ${contextLabel} Window`
              : "Limit Not Specified by Provider"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Input Context"
            value={promptTokens.toLocaleString()}
            hint={`${nonCachedPromptTokens.toLocaleString()} fresh`}
            tone="accent"
            className="p-3"
          />
          <StatCard
            label="Output Generated"
            value={completionTokens.toLocaleString()}
            hint="Completion"
            tone="accent"
            className="p-3"
          />
          <StatCard
            label="KV Cache Read"
            value={cachedTokens.toLocaleString()}
            hint={`${cacheHitRatio}% hit rate`}
            tone="success"
            className="p-3"
          />
          <StatCard
            label="Reasoning CoT"
            value={reasoningTokens.toLocaleString()}
            hint="Thought tokens"
            tone="warning"
            className="p-3"
          />
        </div>

        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <div className="flex justify-between gap-3 text-xs font-medium text-muted">
              <span>Input Context Ratio (System Prompt + History)</span>
              <span className="font-mono font-bold text-accent">{(inputRatio * 100).toFixed(1)}%</span>
            </div>
            <ProgressBar value={inputRatio * 100} barClassName="bg-primary" label="Input context ratio" />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between gap-3 text-xs font-medium text-muted">
              <span>Output Generation Ratio</span>
              <span className="font-mono font-bold text-accent">{(outputRatio * 100).toFixed(1)}%</span>
            </div>
            <ProgressBar value={outputRatio * 100} barClassName="bg-primary" label="Output generation ratio" />
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border">
            <div className="flex justify-between gap-3 text-xs font-medium text-muted">
              <span>Model Context Capacity Utilization</span>
              <span className="font-mono font-bold text-success">
                {maxContextWindow > 0
                  ? `${totalTokens.toLocaleString()} / ${maxContextWindow.toLocaleString()} (${contextUtilization}%)`
                  : `${totalTokens.toLocaleString()} tokens (Not Specified by Provider)`}
              </span>
            </div>
            {maxContextWindow > 0 && (
              <ProgressBar
                value={(totalTokens / maxContextWindow) * 100}
                barClassName="bg-success"
                label="Context capacity utilization"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
