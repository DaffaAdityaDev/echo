"use client";

import { Bell, Brain, Gauge, type LucideIcon, Search, ShieldAlert } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
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

type SectionValueMap = {
  [key: string]: boolean | number | string | string[] | undefined;
};

function readSectionValues(
  sectionConfig: HarnessFeatureToggles[keyof HarnessFeatureToggles] | undefined,
): SectionValueMap {
  if (!sectionConfig) return {};

  return sectionConfig;
}

export function HarnessTab({ config, setConfig }: HarnessTabProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-foreground uppercase tracking-wider block">Agent Harness Guards</p>
      <p className="text-xs text-muted -mt-2">
        Fine-tune the autonomous agent safety systems. Changes apply to new missions.
      </p>

      {sections.map((section) => {
        const groupConfig = readSectionValues(config.harnessToggles?.[section.key]);
        const defaultGroup = readSectionValues(DEFAULT_HARNESS_TOGGLES[section.key]);
        const enabled = Boolean(groupConfig.enabled ?? defaultGroup.enabled ?? true);
        const SectionIcon = section.icon;

        const updateSection = (patch: SectionValueMap) => {
          const currentToggles = config.harnessToggles ?? DEFAULT_HARNESS_TOGGLES;
          const currentSection = readSectionValues(currentToggles[section.key]);
          const nextSection = { ...currentSection, ...patch };

          // SAFETY: Merging patched section object back into feature toggles
          const nextToggles = {
            ...currentToggles,
            [section.key]: nextSection,
          } as HarnessFeatureToggles;

          setConfig({ harnessToggles: nextToggles });
        };

        return (
          <div key={section.key} className="rounded-md border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between p-3.5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-accent/10 text-accent">
                  <SectionIcon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <span className="text-xs font-bold text-foreground">{section.label}</span>
                  <p className="text-xs text-muted">{section.desc}</p>
                </div>
              </div>
              <Switch
                checked={enabled}
                onChange={(next) => updateSection({ enabled: next })}
                label={`Enable ${section.label}`}
              />
            </div>

            {enabled && (
              <div className="p-3.5 space-y-3">
                {section.fields.map((field) => {
                  const inputId = `harness-${section.key}-${field.key}`;

                  return (
                    <div key={field.key} className="flex items-center justify-between gap-3">
                      <label
                        htmlFor={field.type === "number" ? inputId : undefined}
                        className="text-xs font-medium text-muted"
                      >
                        {field.label}
                      </label>
                      {field.type === "toggle" ? (
                        <Switch
                          size="sm"
                          checked={Boolean(groupConfig[field.key] ?? field.default)}
                          onChange={(next) => updateSection({ [field.key]: next })}
                          label={field.label}
                        />
                      ) : (
                        <input
                          id={inputId}
                          type="number"
                          value={Number(groupConfig[field.key] ?? field.default)}
                          onChange={(e) => updateSection({ [field.key]: parseFloat(e.target.value) })}
                          step={field.step ?? 1}
                          min={field.min ?? 0}
                          max={field.max ?? 999999}
                          className="w-20 text-right bg-surface-hover border border-border rounded-md px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-accent/50"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
