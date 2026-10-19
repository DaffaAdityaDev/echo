"use client";

import { AlertTriangle, Layers, ShieldCheck, Sparkles } from "lucide-react";
import type { MaturityDimension, MaturityLevelInfo } from "../../types";

export interface MaturityMatrixProps {
  dimensions: readonly MaturityDimension[];
  levels: readonly MaturityLevelInfo[];
  weakestDimension?: string;
}

export function MaturityMatrix({ dimensions, levels, weakestDimension }: MaturityMatrixProps) {
  return (
    <div className="space-y-6 font-mono text-foreground">
      <div className="border border-border bg-elevated rounded-xs p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-accent" aria-hidden="true" />
              AI-Ready 7-Dimension Maturity Matrix
            </h2>
            <p className="text-xs text-muted mt-1">
              Pattern-agnostic evaluation matrix. Current placement maps to Structured (L3) baseline with Validated (L4)
              guardrails.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono bg-surface px-3 py-1.5 rounded-xs border border-border text-foreground font-semibold">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" aria-hidden="true" />
            Weakest Link Rule: Lowest dimension sets overall system level
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface text-foreground font-bold uppercase tracking-wider">
                <th scope="col" className="py-3 px-4 font-bold w-40">
                  Dimension
                </th>
                <th scope="col" className="py-3 px-4 font-bold w-32">
                  Current State
                </th>
                <th scope="col" className="py-3 px-4 font-bold">
                  L3: Structured (Today)
                </th>
                <th scope="col" className="py-3 px-4 font-bold">
                  L4: Validated (Target)
                </th>
                <th scope="col" className="py-3 px-4 font-bold w-48">
                  Next Pattern Slot
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dimensions.map((dim) => {
                const isWeakest = dim.key === weakestDimension;

                return (
                  <tr
                    key={dim.key}
                    className={`transition-colors hover:bg-surface ${isWeakest ? "bg-warning/10" : ""}`}
                  >
                    <td className="py-4 px-4 font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{dim.name}</span>
                        {isWeakest && (
                          <span
                            title="Weakest Link Dimension"
                            className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded-xs bg-warning/10 border border-warning/30 text-warning font-bold"
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            Bottleneck
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted font-normal mt-0.5 max-w-[160px] leading-snug">
                        {dim.description}
                      </p>
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xs font-mono text-xs font-bold ${
                          dim.currentLevel === "L4"
                            ? "bg-success/10 border border-success text-success"
                            : dim.currentLevel === "L3"
                              ? "bg-accent-soft border border-accent text-accent"
                              : "bg-warning/10 border border-warning text-warning"
                        }`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        {dim.currentLevel}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-foreground font-medium text-xs leading-relaxed max-w-xs">
                      {dim.l3Pattern}
                    </td>

                    <td className="py-4 px-4 text-success font-semibold text-xs leading-relaxed max-w-xs font-mono">
                      {dim.l4Pattern}
                    </td>

                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 text-2xs font-mono font-semibold text-accent bg-accent-soft border border-accent/30 px-2 py-1 rounded-xs">
                        <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {dim.nextSlot || "Self-healing"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {levels.map((lvl) => (
          <div
            key={lvl.level}
            className="border border-border bg-elevated rounded-xs p-4 transition-all shadow-xs text-foreground"
          >
            <div className="flex items-center justify-between font-mono font-bold text-sm">
              <span className="text-accent">{lvl.level}</span>
              <span className="text-2xs uppercase font-bold tracking-wider text-muted">{lvl.name}</span>
            </div>
            <p className="text-xs font-bold text-foreground mt-2 line-clamp-2 leading-tight">{lvl.definition}</p>
            <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">{lvl.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
