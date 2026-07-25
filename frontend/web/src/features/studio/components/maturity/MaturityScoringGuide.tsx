"use client"

import React from "react"
import { CheckSquare, Square, Building2, AlertTriangle, Save, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/Button"
import type {
  ScoringQuestion,
  MaturityDimensionKey,
  MaturityLevel,
  ClientCompanyAssessment,
} from "../../types"

export interface MaturityScoringGuideProps {
  questions: readonly ScoringQuestion[]
  questionAnswers: Record<string, boolean>
  onToggleQuestion: (qId: string) => void
  clientAssessment: ClientCompanyAssessment
  clientName: string
  onClientNameChange: (name: string) => void
  onClientScoreChange: (dimension: MaturityDimensionKey, level: MaturityLevel) => void
  onClientEvidenceChange: (dimension: MaturityDimensionKey, text: string) => void
  onSaveClientAssessment?: () => void
}

const DIMENSION_LABELS: Record<MaturityDimensionKey, string> = {
  tools: "Tools",
  skills: "Skills",
  prompts: "Prompts",
  security: "API Security",
  data: "Data Models",
  observability: "Observability",
  documentation: "Documentation",
}

const LEVELS_LIST: MaturityLevel[] = ["L1", "L2", "L3", "L4", "L5"]

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
  const [subTab, setSubTab] = React.useState<"self" | "client">("self")

  return (
    <div className="space-y-6">
      {/* Sub-tab selection */}
      <div className="flex border-b border-zinc-800 gap-6">
        <button
          onClick={() => setSubTab("self")}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
            subTab === "self"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Internal Self-Assessment Questions
        </button>
        <button
          onClick={() => setSubTab("client")}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 ${
            subTab === "client"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          External Client Diagnostics
        </button>
      </div>

      {subTab === "self" ? (
        <div className="border border-zinc-800/80 bg-zinc-900/40 rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-400" />
              Dimension Self-Assessment Checklist
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Answer key criteria questions to evaluate whether a dimension meets L3 (Structured) or L4 (Validated) status.
            </p>
          </div>

          <div className="space-y-2 mt-4">
            {questions.map((q) => {
              const isChecked = !!questionAnswers[q.id]
              return (
                <div
                  key={q.id}
                  onClick={() => onToggleQuestion(q.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isChecked
                      ? "border-blue-500/30 bg-blue-500/10 text-zinc-100"
                      : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isChecked ? (
                      <CheckSquare className="h-5 w-5 text-blue-400 shrink-0" />
                    ) : (
                      <Square className="h-5 w-5 text-zinc-600 shrink-0" />
                    )}
                    <span className="text-xs md:text-sm font-medium">{q.question}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {DIMENSION_LABELS[q.dimension]}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
                      Requires {q.minLevel}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="border border-zinc-800/80 bg-zinc-900/40 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-400" />
                Client Company Assessment & Diagnostic Tool
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Evaluate client readiness across 7 dimensions before AI integration.
              </p>
            </div>

            {onSaveClientAssessment && (
              <Button size="sm" onClick={onSaveClientAssessment} className="gap-2 text-xs">
                <Save className="h-3.5 w-3.5" />
                Save Client Diagnostic
              </Button>
            )}
          </div>

          {/* Client Info & Score summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-zinc-300">Client Company Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => onClientNameChange(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="border border-zinc-800 bg-zinc-950 rounded-xl p-4 flex flex-col justify-center">
              <span className="text-xs text-zinc-400">Calculated Client Maturity Level</span>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-2xl font-bold font-mono text-purple-400">
                  {clientAssessment.overallLevel}
                </span>
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Weakest: {DIMENSION_LABELS[clientAssessment.weakestDimension]}
                </span>
              </div>
            </div>
          </div>

          {/* 7 Dimensions Scoring Grid */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Dimension Level & Evidence Inputs
            </h4>

            {(Object.keys(clientAssessment.scores) as MaturityDimensionKey[]).map((dimKey) => {
              const item = clientAssessment.scores[dimKey]
              return (
                <div
                  key={dimKey}
                  className="border border-zinc-800/60 bg-zinc-950/60 rounded-xl p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-sm font-bold text-zinc-200">
                      {DIMENSION_LABELS[dimKey]}
                    </span>

                    {/* Level selector */}
                    <div className="flex items-center gap-1.5">
                      {LEVELS_LIST.map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => onClientScoreChange(dimKey, lvl)}
                          className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                            item.level === lvl
                              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                              : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={item.evidence}
                    onChange={(e) => onClientEvidenceChange(dimKey, e.target.value)}
                    placeholder="Evidence (e.g. REST API exists, but no Zod schemas)..."
                    className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
