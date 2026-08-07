"use client";

import { AlertTriangle, HelpCircle, Layers, Map as MapIcon, Sparkles } from "lucide-react";
import type {
  ClientCompanyAssessment,
  MaturityDimension,
  MaturityDimensionKey,
  MaturityLevel,
  MaturityLevelInfo,
  RoadmapItem,
  ScoringQuestion,
  SystemMaturityAssessment,
} from "../../types";
import { MaturityMatrix } from "./MaturityMatrix";
import { MaturityRoadmap } from "./MaturityRoadmap";
import { MaturityScoringGuide } from "./MaturityScoringGuide";

interface MaturityDashboardProps {
  activeTab: "matrix" | "scoring" | "roadmap" | "client";
  setActiveTab: (tab: "matrix" | "scoring" | "roadmap" | "client") => void;
  echoAssessment: SystemMaturityAssessment;
  clientAssessment: ClientCompanyAssessment;
  clientName: string;
  setClientName: (name: string) => void;
  setClientScore: (dimension: MaturityDimensionKey, level: MaturityLevel) => void;
  setClientEvidence: (dimension: MaturityDimensionKey, text: string) => void;
  roadmap: RoadmapItem[];
  toggleRoadmapStatus: (id: string) => void;
  questionAnswers: Record<string, boolean>;
  toggleQuestion: (qId: string) => void;
  levelsInfo: readonly MaturityLevelInfo[];
  dimensions: readonly MaturityDimension[];
  questions: readonly ScoringQuestion[];
  serverAssessment: SystemMaturityAssessment | null;
  isSaving: boolean;
  onSaveClient: () => void;
}

export function MaturityDashboard({
  activeTab,
  setActiveTab,
  echoAssessment,
  clientAssessment,
  clientName,
  setClientName,
  setClientScore,
  setClientEvidence,
  roadmap,
  toggleRoadmapStatus,
  questionAnswers,
  toggleQuestion,
  levelsInfo,
  dimensions,
  questions,
  onSaveClient,
}: MaturityDashboardProps) {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="border border-border bg-white rounded-xs p-6 relative overflow-hidden shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 font-mono">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-xs bg-blue-50 border border-gb-bright-blue/40 text-gb-blue text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Ready System Maturity Model v1.0
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              System Maturity & AI Readiness
            </h1>
            <p className="text-xs md:text-sm text-slate-600 max-w-2xl mt-1 leading-relaxed">
              Evaluates AI readiness across 7 pattern-agnostic dimensions. Governed by the Weakest Link Rule â€” a
              system is only as mature as its lowest dimension.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0 font-mono">
            <div className="border border-gb-bright-blue/40 bg-blue-50 rounded-xs px-4 py-3 text-center">
              <div className="text-[10px] text-gb-blue font-bold uppercase tracking-wider">Overall Echo Level</div>
              <div className="text-3xl font-black text-foreground mt-0.5">{echoAssessment.overallLevel}</div>
              <div className="text-[10px] text-slate-600 font-medium mt-0.5">Structured Baseline</div>
            </div>

            <div className="border border-amber-300 bg-amber-50 rounded-xs px-4 py-3 text-center">
              <div className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">Weakest Link</div>
              <div className="text-sm font-bold text-amber-900 mt-1 capitalize">{echoAssessment.weakestDimension}</div>
              <div className="text-[10px] text-amber-700 mt-0.5 flex items-center justify-center gap-1 font-semibold">
                <AlertTriangle className="h-3 w-3" /> Bottleneck
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-6 font-mono">
        <button
          type="button"
          onClick={() => setActiveTab("matrix")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === "matrix"
              ? "border-gb-blue text-gb-blue"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <Layers className="h-4 w-4" />
          7-Dimension Matrix
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("roadmap")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === "roadmap"
              ? "border-gb-blue text-gb-blue"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <MapIcon className="h-4 w-4" />
          Roadmap to Validated (L4)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("scoring")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === "scoring"
              ? "border-gb-blue text-gb-blue"
              : "border-transparent text-muted hover:text-foreground"
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

      {activeTab === "roadmap" && <MaturityRoadmap items={roadmap} onToggleStatus={toggleRoadmapStatus} />}

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
          onSaveClientAssessment={onSaveClient}
        />
      )}
    </div>
  );
}
