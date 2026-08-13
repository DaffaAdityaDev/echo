"use client";

import { Bell, Brain, Gauge, type LucideIcon, Search, ShieldAlert } from "lucide-react";
import { cn } from "@/utils/cn";
import type { AgentConfig, HarnessFeatureToggles } from "../../types";
import { DEFAULT_HARNESS_TOGGLES } from "../../types";

interface HarnessTabProps {
  config: AgentConfig;
  setConfig: (partial: Partial<AgentConfig>) => void;
}

interface HarnessField {
  key: string;
  label: string;
  type: "toggle" | "number";
  default: number | boolean;
  step?: number;
  min?: number;
  max?: number;
}

interface HarnessSection {
  key: keyof HarnessFeatureToggles;
  label: string;
  desc: string;
  icon: LucideIcon;
  fields: HarnessField[];
}

const sections: HarnessSection[] = [
  {
    key: "loopDetection",
    label: "Loop Detection",
    desc: "Exact-match & cosine-similarity loop detection",
    icon: Search,
    fields: [
      { key: "enableExactMatch", label: "Exact Match", type: "toggle", default: true },
      { key: "enableCosineSimilarity", label: "Cosine Similarity", type: "toggle", default: true },
      { key: "maxConsecutiveIdenticalCalls", label: "Max Identical Calls", type: "number", default: 3 },
      {
        key: "similarityThreshold",
        label: "Similarity Threshold",
        type: "number",
        default: 0.92,
        step: 0.01,
        min: 0,
        max: 1,
      },
      { key: "windowSize", label: "Window Size", type: "number", default: 10 },
    ],
  },
  {
    key: "budgetMonitor",
    label: "Budget Monitor",
    desc: "Step/time/cost budgets",
    icon: Gauge,
    fields: [
      { key: "enforceMaxSteps", label: "Max Steps", type: "toggle", default: true },
      { key: "maxSteps", label: "Step Limit", type: "number", default: 15 },
      { key: "enforceTimeout", label: "Timeout", type: "toggle", default: true },
      { key: "maxDurationMs", label: "Max Duration (ms)", type: "number", default: 120000 },
      { key: "enforceCostCap", label: "Cost Cap", type: "toggle", default: true },
      { key: "maxCostUsd", label: "Max Cost (USD)", type: "number", default: 1.0, step: 0.1 },
    ],
  },
  {
    key: "systemNotices",
    label: "System Notices",
    desc: "Emit warnings to the frontend",
    icon: Bell,
    fields: [
      { key: "emitLoopWarnings", label: "Loop Warnings", type: "toggle", default: true },
      { key: "emitCompactionNotices", label: "Compaction Notices", type: "toggle", default: true },
      { key: "emitBudgetWarnings", label: "Budget Warnings", type: "toggle", default: true },
      { key: "emitPacingWarnings", label: "Pacing Warnings", type: "toggle", default: true },
    ],
  },
  {
    key: "hitlGuard",
    label: "HITL Guard",
    desc: "Human-in-the-loop for protected tools",
    icon: ShieldAlert,
    fields: [{ key: "ttlMinutes", label: "Approval TTL (min)", type: "number", default: 5 }],
  },
  {
    key: "contextOptimization",
    label: "Context Optimization",
    desc: "Prefix caching & auto-compaction",
    icon: Brain,
    fields: [
      { key: "enablePrefixCachingLayout", label: "Prefix Caching", type: "toggle", default: true },
      { key: "enableAutoCompaction", label: "Auto Compaction", type: "toggle", default: true },
      {
        key: "compactionThresholdRatio",
        label: "Compaction Ratio",
        type: "number",
        default: 0.7,
        step: 0.05,
        min: 0,
        max: 1,
      },
      { key: "keepLastTurnsCount", label: "Keep Last Turns", type: "number", default: 4 },
    ],
  },
];

function asToggleGroup(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function HarnessTab({ config, setConfig }: HarnessTabProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
        Agent Harness Guards
      </p>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 -mt-2">
        Fine-tune the autonomous agent safety systems. Changes apply to new missions.
      </p>

      {sections.map((section) => {
        const groupConfig = asToggleGroup(config.harnessToggles?.[section.key]);
        const defaultGroup = asToggleGroup(DEFAULT_HARNESS_TOGGLES[section.key]);
        const enabled = Boolean(groupConfig.enabled ?? defaultGroup.enabled ?? true);
        const SectionIcon = section.icon;

        const updateToggles = (patchGroup: (group: Record<string, unknown>) => Record<string, unknown>) => {
          const toggles: Record<string, unknown> = {
            ...(config.harnessToggles ?? DEFAULT_HARNESS_TOGGLES),
          };
          toggles[section.key] = patchGroup(asToggleGroup(toggles[section.key]));
          setConfig({ harnessToggles: toggles as HarnessFeatureToggles });
        };

        return (
          <div
            key={section.key}
            className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/40 overflow-hidden"
          >
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
                type="button"
                onClick={() => updateToggles((group) => ({ ...group, enabled: !enabled }))}
                aria-label={`Toggle ${section.label}`}
                aria-pressed={enabled}
                className={cn(
                  "relative w-9 h-5 rounded-full transition-colors cursor-pointer",
                  enabled ? "bg-purple-500" : "bg-zinc-300 dark:bg-zinc-700",
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                    enabled && "translate-x-4",
                  )}
                />
              </button>
            </div>

            {enabled && (
              <div className="p-3.5 space-y-3">
                {section.fields.map((field) => (
                  <div key={field.key} className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{field.label}</span>
                    {field.type === "toggle" ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateToggles((group) => ({ ...group, [field.key]: !(group[field.key] ?? field.default) }))
                        }
                        aria-label={`Toggle ${field.label}`}
                        aria-pressed={Boolean(groupConfig[field.key] ?? field.default)}
                        className={cn(
                          "relative w-8 h-4 rounded-full transition-colors cursor-pointer",
                          (groupConfig[field.key] ?? field.default) ? "bg-purple-500" : "bg-zinc-300 dark:bg-zinc-700",
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform",
                            (groupConfig[field.key] ?? field.default) && "translate-x-4",
                          )}
                        />
                      </button>
                    ) : (
                      <input
                        type="number"
                        value={Number(groupConfig[field.key] ?? field.default)}
                        onChange={(e) =>
                          updateToggles((group) => ({ ...group, [field.key]: parseFloat(e.target.value) }))
                        }
                        step={field.step ?? 1}
                        min={field.min ?? 0}
                        max={field.max ?? 999999}
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
