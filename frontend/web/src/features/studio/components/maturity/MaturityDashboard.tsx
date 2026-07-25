"use client"

import React from "react"
import { ShieldCheck, Layers, Map, HelpCircle, AlertTriangle, ArrowRight, Sparkles } from "lucide-react"
import { useMaturityModel } from "../../hooks/useMaturityModel"
import { MaturityMatrix } from "./MaturityMatrix"
import { MaturityRoadmap } from "./MaturityRoadmap"
import { MaturityScoringGuide } from "./MaturityScoringGuide"

export function MaturityDashboard() {
  const {
    activeTab,
    setActiveTab,
    echoAssessment,
    clientAssessment,
    clientName,
    setClientName,
    clientScores,
    setClientScore,
    clientEvidences,
    setClientEvidence,
    roadmap,
    toggleRoadmapStatus,
    questionAnswers,
    toggleQuestion,
    levelsInfo,
    dimensions,
    questions,
  } = useMaturityModel()

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="border border-zinc-800/80 bg-zinc-900/40 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 h-40 w-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Ready System Maturity Model v1.0
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-100">
              System Maturity & AI Readiness
            </h1>
            <p className="text-xs md:text-sm text-zinc-400 max-w-2xl mt-1">
              Evaluates AI readiness across 7 pattern-agnostic dimensions. Governed by the Weakest Link Rule — a system is only as mature as its lowest dimension.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="border border-blue-500/30 bg-blue-500/10 rounded-xl px-4 py-3 text-center">
              <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Overall Echo Level</div>
              <div className="text-3xl font-black font-mono text-zinc-100 mt-0.5">
                {echoAssessment.overallLevel}
              </div>
              <div className="text-[10px] text-zinc-400 mt-0.5">Structured Baseline</div>
            </div>

            <div className="border border-amber-500/30 bg-amber-500/10 rounded-xl px-4 py-3 text-center">
              <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Weakest Link</div>
              <div className="text-sm font-bold font-mono text-amber-300 mt-1 capitalize">
                {echoAssessment.weakestDimension}
              </div>
              <div className="text-[10px] text-amber-400/80 mt-0.5 flex items-center justify-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Bottleneck
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 gap-6">
        <button
          onClick={() => setActiveTab("matrix")}
          className={`pb-3 text-sm font-semibold transition-all flex items-center gap-2 border-b-2 ${
            activeTab === "matrix"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Layers className="h-4 w-4" />
          7-Dimension Matrix
        </button>

        <button
          onClick={() => setActiveTab("roadmap")}
          className={`pb-3 text-sm font-semibold transition-all flex items-center gap-2 border-b-2 ${
            activeTab === "roadmap"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Map className="h-4 w-4" />
          Roadmap to Validated (L4)
        </button>

        <button
          onClick={() => setActiveTab("scoring")}
          className={`pb-3 text-sm font-semibold transition-all flex items-center gap-2 border-b-2 ${
            activeTab === "scoring"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          Scoring & Client Diagnostics
        </button>
      </div>

      {/* Main Content View */}
      {activeTab === "matrix" && (
        <MaturityMatrix
          dimensions={dimensions}
          levels={levelsInfo}
          weakestDimension={echoAssessment.weakestDimension}
        />
      )}

      {activeTab === "roadmap" && (
        <MaturityRoadmap items={roadmap} onToggleStatus={toggleRoadmapStatus} />
      )}

      {activeTab === "scoring" && (
        <MaturityScoringGuide
          questions={questions}
          questionAnswers={questionAnswers}
          onToggleQuestion={toggleQuestion}
          clientAssessment={clientAssessment}
          clientName={clientName}
          onClientNameChange={setClientName}
          onClientScoreChange={setClientScore}
          onClientEvidenceChange={setClientEvidence}
        />
      )}
    </div>
  )
}
