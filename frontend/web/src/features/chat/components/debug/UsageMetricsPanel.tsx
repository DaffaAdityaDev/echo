"use client";

import { Coins, Gauge, Zap } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useCumulativeUsage } from "../../hooks/useChatSelectors";

export function UsageMetricsPanel() {
  const cumulativeUsage = useCumulativeUsage();

  const promptTokens = cumulativeUsage?.promptTokens || 0;
  const completionTokens = cumulativeUsage?.completionTokens || 0;
  const totalTokens = cumulativeUsage?.totalTokens || 0;
  const cachedTokens = cumulativeUsage?.cachedTokens || 0;
  const reasoningTokens = cumulativeUsage?.reasoningTokens || 0;

  const cacheHitRatio = promptTokens > 0 ? ((cachedTokens / promptTokens) * 100).toFixed(1) : "0.0";
  const nonCachedPromptTokens = Math.max(0, promptTokens - cachedTokens);

  const maxContextWindow = cumulativeUsage?.maxContextTokens || 0;
  const contextUtilization = maxContextWindow > 0 ? ((totalTokens / maxContextWindow) * 100).toFixed(2) : "0.00";
  const contextLabel =
    maxContextWindow >= 1000000
      ? `${(maxContextWindow / 1000000).toFixed(0)}M`
      : `${(maxContextWindow / 1000).toFixed(0)}k`;

  const estimatedCost = (cumulativeUsage?.estimatedCostUsd ?? 0).toFixed(5);

  const inputRatio = promptTokens / Math.max(totalTokens, 1);
  const outputRatio = completionTokens / Math.max(totalTokens, 1);

  return (
    <div className="space-y-4">
      {/* Top Stat Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* KV Prompt Cache Read */}
        <div className="p-4 rounded-2xl border border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> KV Cache Hits / Read
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              {cacheHitRatio}% SAVED
            </span>
          </div>
          <div className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
            {cachedTokens.toLocaleString()}{" "}
            <span className="text-xs text-zinc-500 font-sans font-normal">
              / {promptTokens.toLocaleString()} tokens
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Tokens served directly from KV Prefix Cache (50-80% faster response).
          </p>
        </div>

        {/* Estimated USD Cost */}
        <div className="p-4 rounded-2xl border border-purple-500/30 dark:border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/20 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5" /> Est. Session Cost
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-purple-500/20 text-purple-700 dark:text-purple-300 font-mono">
              USD
            </span>
          </div>
          <div className="text-xl font-extrabold font-mono text-purple-600 dark:text-purple-300">${estimatedCost}</div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
            Calculated using active model input, output & cache read rates.
          </p>
        </div>
      </div>

      {/* Comprehensive Context & Breakdown Panel */}
      <div className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
              Context Window & Token Breakdown
            </h4>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {maxContextWindow > 0
              ? `${contextUtilization}% of ${contextLabel} Window`
              : "Limit Not Specified by Provider"}
          </span>
        </div>

        {/* Grid 4 Columns */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-medium">Input Context</span>
            <span className="text-sm font-extrabold font-mono text-blue-600 dark:text-blue-400">
              {promptTokens.toLocaleString()}
            </span>
            <span className="text-[9px] text-zinc-400 block mt-0.5 font-mono">
              {nonCachedPromptTokens.toLocaleString()} fresh
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-medium">Output Generated</span>
            <span className="text-sm font-extrabold font-mono text-purple-600 dark:text-purple-400">
              {completionTokens.toLocaleString()}
            </span>
            <span className="text-[9px] text-zinc-400 block mt-0.5 font-mono">Completion</span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-medium">KV Cache Read</span>
            <span className="text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
              {cachedTokens.toLocaleString()}
            </span>
            <span className="text-[9px] text-zinc-400 block mt-0.5 font-mono">{cacheHitRatio}% hit rate</span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-medium">Reasoning CoT</span>
            <span className="text-sm font-extrabold font-mono text-amber-600 dark:text-amber-400">
              {reasoningTokens.toLocaleString()}
            </span>
            <span className="text-[9px] text-zinc-400 block mt-0.5 font-mono">Thought tokens</span>
          </div>
        </div>

        {/* Progress bars */}
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <span>Input Context Ratio (System Prompt + History)</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                {(inputRatio * 100).toFixed(1)}%
              </span>
            </div>
            <ProgressBar value={inputRatio * 100} barClassName="bg-blue-500" />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <span>Output Generation Ratio</span>
              <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                {(outputRatio * 100).toFixed(1)}%
              </span>
            </div>
            <ProgressBar value={outputRatio * 100} barClassName="bg-purple-500" />
          </div>

          {/* Context Capacity Utilization */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <span>Model Context Capacity Utilization</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {maxContextWindow > 0
                  ? `${totalTokens.toLocaleString()} / ${maxContextWindow.toLocaleString()} (${contextUtilization}%)`
                  : `${totalTokens.toLocaleString()} tokens (Not Specified by Provider)`}
              </span>
            </div>
            {maxContextWindow > 0 && (
              <ProgressBar value={(totalTokens / maxContextWindow) * 100} barClassName="bg-emerald-500" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
