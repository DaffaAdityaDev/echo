"use client";

import { AlertTriangle, Building2, CheckSquare, HelpCircle, Save, Square } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import type { ClientCompanyAssessment, MaturityDimensionKey, MaturityLevel, ScoringQuestion } from "../../types";

export interface MaturityScoringGuideProps {
  questions: readonly ScoringQuestion[];
  questionAnswers: Record<string, boolean>;
  onToggleQuestion: (qId: string) => void;
  clientAssessment: ClientCompanyAssessment;
  clientName: string;
  onClientNameChange: (name: string) => void;
  onClientScoreChange: (dimension: MaturityDimensionKey, level: MaturityLevel) => void;
  onClientEvidenceChange: (dimension: MaturityDimensionKey, text: string) => void;
  onSaveClientAssessment?: () => void;
}

const DIMENSION_LABELS: Record<MaturityDimensionKey, string> = {
  tools: "Tools",
  skills: "Skills",
  prompts: "Prompts",
  security: "API Security",
  data: "Data Models",
  observability: "Observability",
  documentation: "Documentation",
};

const LEVELS_LIST: MaturityLevel[] = ["L1", "L2", "L3", "L4", "L5"];

export function MaturityScoringGuide({
  questions,
  questionAnswers,
  onToggleQuestion,
  clientAssessment,
  clientName,
  onClientNameChange,
  onClientScoreChange,
  onClientEvidenceChange,
  onSaveClientAssessment,
}: MaturityScoringGuideProps) {
  const [subTab, setSubTab] = React.useState<"self" | "client">("self");

  // SAFETY: clientAssessment.scores is an exhaustive record indexed by MaturityDimensionKey
  const dimensionKeys = Object.keys(clientAssessment.scores) as MaturityDimensionKey[];

  return (
    <div className="space-y-6">
      <div className="border-b border-border">
        <Tabs
          tabs={[
            { id: "self", label: "Internal Self-Assessment Questions" },
            { id: "client", label: "External Client Diagnostics" },
          ]}
          active={subTab}
          onChange={setSubTab}
          ariaLabel="Assessment type"
          className="gap-6 overflow-x-auto"
          itemClassName="pb-3 text-sm whitespace-nowrap"
          activeClassName="border-accent text-accent"
          inactiveClassName="border-transparent text-muted hover:text-foreground"
        />
      </div>

      {subTab === "self" ? (
        <div className="border border-border bg-elevated rounded-md p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-accent" aria-hidden="true" />
              Dimension Self-Assessment Checklist
            </h2>
            <p className="text-xs text-muted mt-1">
              Answer key criteria questions to evaluate whether a dimension meets L3 (Structured) or L4 (Validated)
              status.
            </p>
          </div>

          <div className="space-y-2 mt-4">
            {questions.map((q) => {
              const isChecked = !!questionAnswers[q.id];

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onToggleQuestion(q.id)}
                  aria-pressed={isChecked}
                  className={`w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-md border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                    isChecked
                      ? "border-accent/30 bg-accent/10 text-foreground"
                      : "border-border bg-surface text-muted hover:bg-surface-hover"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {isChecked ? (
                      <CheckSquare className="h-5 w-5 text-accent shrink-0" aria-hidden="true" />
                    ) : (
                      <Square className="h-5 w-5 text-muted shrink-0" aria-hidden="true" />
                    )}
                    <span className="text-xs md:text-sm font-medium">{q.question}</span>
                  </span>

                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-2xs font-mono px-2 py-0.5 rounded-sm bg-surface-hover text-muted border border-border-strong">
                      {DIMENSION_LABELS[q.dimension]}
                    </span>
                    <span className="text-2xs font-mono px-2 py-0.5 rounded-sm bg-accent/15 text-accent font-semibold">
                      Requires {q.minLevel}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border border-border bg-elevated rounded-md p-4 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-accent" aria-hidden="true" />
                Client Company Assessment & Diagnostic Tool
              </h2>
              <p className="text-xs text-muted mt-1">
                Evaluate client readiness across 7 dimensions before AI integration.
              </p>
            </div>

            {onSaveClientAssessment ? (
              <Button size="sm" onClick={onSaveClientAssessment} className="gap-2 text-xs">
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                Save Client Diagnostic
              </Button>
            ) : (
              <p className="text-xs text-muted">Diagnostics are not saved: server storage is not available yet.</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label htmlFor="client-company-name" className="text-xs font-semibold text-muted">
                Client Company Name
              </label>
              <input
                id="client-company-name"
                type="text"
                value={clientName}
                onChange={(e) => onClientNameChange(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full bg-surface border border-border rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:border-accent"
              />
            </div>

            <div className="border border-border bg-surface rounded-md p-4 flex flex-col justify-center">
              <span className="text-xs text-muted">Calculated Client Maturity Level</span>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-2xl font-bold font-mono text-accent">{clientAssessment.overallLevel}</span>
                <span className="text-xs text-warning flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Weakest: {DIMENSION_LABELS[clientAssessment.weakestDimension]}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Dimension Level & Evidence Inputs</h3>

            {dimensionKeys.map((dimKey) => {
              const item = clientAssessment.scores[dimKey];

              return (
                <div key={dimKey} className="border border-border bg-surface rounded-md p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span id={`dimension-${dimKey}`} className="text-sm font-bold text-foreground">
                      {DIMENSION_LABELS[dimKey]}
                    </span>

                    <div role="group" aria-labelledby={`dimension-${dimKey}`} className="flex items-center gap-1.5">
                      {LEVELS_LIST.map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => onClientScoreChange(dimKey, lvl)}
                          aria-pressed={item.level === lvl}
                          className={`px-2.5 py-1 text-xs font-mono font-bold rounded-sm transition-all cursor-pointer ${
                            item.level === lvl
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-surface-hover text-muted hover:bg-border hover:text-foreground"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    aria-label={`${DIMENSION_LABELS[dimKey]} evidence`}
                    value={item.evidence}
                    onChange={(e) => onClientEvidenceChange(dimKey, e.target.value)}
                    placeholder="Evidence (e.g. REST API exists, but no Zod schemas)..."
                    className="w-full bg-elevated border border-border rounded-sm px-3 py-1.5 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-accent"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
