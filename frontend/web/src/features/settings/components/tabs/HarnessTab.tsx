"use client";

import { cn } from "@/utils/cn";
import { ShieldAlert, Brain, Gauge, Bell, Search } from "lucide-react";
import { DEFAULT_HARNESS_TOGGLES } from "../../types";
import type { AgentConfig } from "../../types";

interface HarnessTabProps {
  config: AgentConfig;
  setConfig: (partial: Partial<AgentConfig>) => void;
}

const sections = [
  { key: 'loopDetection', label: 'Loop Detection', desc: 'Exact-match & cosine-similarity loop detection', icon: Search, fields: [
    { key: 'enableExactMatch', label: 'Exact Match', type: 'toggle' as const, default: true },
    { key: 'enableCosineSimilarity', label: 'Cosine Similarity', type: 'toggle' as const, default: true },
    { key: 'maxConsecutiveIdenticalCalls', label: 'Max Identical Calls', type: 'number' as const, default: 3 },
    { key: 'similarityThreshold', label: 'Similarity Threshold', type: 'number' as const, default: 0.92, step: 0.01, min: 0, max: 1 },
    { key: 'windowSize', label: 'Window Size', type: 'number' as const, default: 10 },
  ]},
  { key: 'budgetMonitor', label: 'Budget Monitor', desc: 'Step/time/cost budgets', icon: Gauge, fields: [
    { key: 'enforceMaxSteps', label: 'Max Steps', type: 'toggle' as const, default: true },
    { key: 'maxSteps', label: 'Step Limit', type: 'number' as const, default: 15 },
    { key: 'enforceTimeout', label: 'Timeout', type: 'toggle' as const, default: true },
    { key: 'maxDurationMs', label: 'Max Duration (ms)', type: 'number' as const, default: 120000 },
    { key: 'enforceCostCap', label: 'Cost Cap', type: 'toggle' as const, default: true },
    { key: 'maxCostUsd', label: 'Max Cost (USD)', type: 'number' as const, default: 1.0, step: 0.1 },
  ]},
  { key: 'systemNotices', label: 'System Notices', desc: 'Emit warnings to the frontend', icon: Bell, fields: [
    { key: 'emitLoopWarnings', label: 'Loop Warnings', type: 'toggle' as const, default: true },
    { key: 'emitCompactionNotices', label: 'Compaction Notices', type: 'toggle' as const, default: true },
    { key: 'emitBudgetWarnings', label: 'Budget Warnings', type: 'toggle' as const, default: true },
    { key: 'emitPacingWarnings', label: 'Pacing Warnings', type: 'toggle' as const, default: true },
  ]},
  { key: 'hitlGuard', label: 'HITL Guard', desc: 'Human-in-the-loop for protected tools', icon: ShieldAlert, fields: [
    { key: 'ttlMinutes', label: 'Approval TTL (min)', type: 'number' as const, default: 5 },
  ]},
  { key: 'contextOptimization', label: 'Context Optimization', desc: 'Prefix caching & auto-compaction', icon: Brain, fields: [
    { key: 'enablePrefixCachingLayout', label: 'Prefix Caching', type: 'toggle' as const, default: true },
    { key: 'enableAutoCompaction', label: 'Auto Compaction', type: 'toggle' as const, default: true },
    { key: 'compactionThresholdRatio', label: 'Compaction Ratio', type: 'number' as const, default: 0.7, step: 0.05, min: 0, max: 1 },
    { key: 'keepLastTurnsCount', label: 'Keep Last Turns', type: 'number' as const, default: 4 },
  ]},
];

export function HarnessTab({ config, setConfig }: HarnessTabProps) {
  return (
    <div className="space-y-4">
      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
        Agent Harness Guards
      </label>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 -mt-2">
        Fine-tune the autonomous agent safety systems. Changes apply to new missions.
      </p>

      {sections.map((section) => {
        const groupConfig = config.harnessToggles?.[section.key as keyof typeof DEFAULT_HARNESS_TOGGLES];
        const enabled = groupConfig?.enabled ?? ((DEFAULT_HARNESS_TOGGLES[section.key as keyof typeof DEFAULT_HARNESS_TOGGLES] as any)?.enabled ?? true);
        const SectionIcon = section.icon;

        return (
          <div key={section.key} className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/40 overflow-hidden">
            <div className="flex items-center justify-between p-3.5 border-b border-zinc-200/60 dark:border-zinc-800/60">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
                  <SectionIcon className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{section.label}</span>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{section.desc}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const toggles = { ...config.harnessToggles ?? DEFAULT_HARNESS_TOGGLES };
                  (toggles as any)[section.key] = { ...(toggles as any)[section.key] ?? {}, enabled: !enabled };
                  setConfig({ harnessToggles: toggles });
                }}
                className={cn(
                  "relative w-9 h-5 rounded-full transition-colors cursor-pointer",
                  enabled ? "bg-purple-500" : "bg-zinc-300 dark:bg-zinc-700"
                )}
              >
                <div className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                  enabled && "translate-x-4"
                )} />
              </button>
            </div>

            {enabled && (
              <div className="p-3.5 space-y-3">
                {section.fields.map((field) => (
                  <div key={field.key} className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{field.label}</span>
                    {field.type === 'toggle' ? (
                      <button
                        onClick={() => {
                          const toggles = { ...config.harnessToggles ?? DEFAULT_HARNESS_TOGGLES };
                          const group = { ...(toggles as any)[section.key] ?? {} };
                          group[field.key] = group[field.key] ?? field.default;
                          group[field.key] = !group[field.key];
                          (toggles as any)[section.key] = group;
                          setConfig({ harnessToggles: toggles });
                        }}
                        className={cn(
                          "relative w-8 h-4 rounded-full transition-colors cursor-pointer",
                          (groupConfig?.[field.key as keyof typeof groupConfig] ?? field.default) ? "bg-purple-500" : "bg-zinc-300 dark:bg-zinc-700"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform",
                          (groupConfig?.[field.key as keyof typeof groupConfig] ?? field.default) && "translate-x-4"
                        )} />
                      </button>
                    ) : (
                      <input
                        type="number"
                        value={Number((groupConfig as any)?.[field.key] ?? field.default)}
                        onChange={(e) => {
                          const toggles = { ...config.harnessToggles ?? DEFAULT_HARNESS_TOGGLES };
                          const group = { ...(toggles as any)[section.key] ?? {} };
                          group[field.key] = parseFloat(e.target.value);
                          (toggles as any)[section.key] = group;
                          setConfig({ harnessToggles: toggles });
                        }}
                        step={(field as any).step ?? 1}
                        min={(field as any).min ?? 0}
                        max={(field as any).max ?? 999999}
                        className="w-20 text-right bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-mono text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-purple-500/50"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
