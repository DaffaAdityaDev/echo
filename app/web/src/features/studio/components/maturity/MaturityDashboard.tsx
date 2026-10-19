"use client";

import { AlertTriangle, HelpCircle, Layers, Map as MapIcon, Sparkles } from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";
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
}: MaturityDashboardProps) {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="border border-border bg-elevated rounded-xs p-6 relative overflow-hidden shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10 font-mono">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-xs bg-accent-soft border border-accent/30 text-accent text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              AI-Ready System Maturity Model v1.0
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              System Maturity & AI Readiness
            </h1>
            <p className="text-xs md:text-sm text-muted max-w-2xl mt-1 leading-relaxed">
              Evaluates AI readiness across 7 pattern-agnostic dimensions. Governed by the Weakest Link Rule — a system
              is only as mature as its lowest dimension.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0 font-mono">
            <div className="border border-accent/30 bg-accent-soft rounded-xs px-4 py-3 text-center">
              <div className="text-2xs text-accent font-bold uppercase tracking-wider">Overall Echo Level</div>
              <div className="text-3xl font-bold text-foreground mt-0.5">{echoAssessment.overallLevel}</div>
              <div className="text-2xs text-muted font-medium mt-0.5">Structured Baseline</div>
            </div>

            <div className="border border-warning/30 bg-warning/10 rounded-xs px-4 py-3 text-center">
              <div className="text-2xs text-warning font-bold uppercase tracking-wider">Weakest Link</div>
              <div className="text-sm font-bold text-warning mt-1 capitalize">{echoAssessment.weakestDimension}</div>
              <div className="text-2xs text-warning mt-0.5 flex items-center justify-center gap-1 font-semibold">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Bottleneck
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-border">
        <Tabs
          tabs={[
            { id: "matrix", label: "7-Dimension Matrix", icon: Layers },
            { id: "roadmap", label: "Roadmap to Validated (L4)", icon: MapIcon },
            { id: "scoring", label: "Scoring & Client Diagnostics", icon: HelpCircle },
          ]}
          active={activeTab}
          onChange={setActiveTab}
          ariaLabel="Maturity views"
          className="gap-6 font-mono overflow-x-auto"
          itemClassName="pb-3 uppercase tracking-wider whitespace-nowrap"
          activeClassName="border-accent text-accent font-bold"
          inactiveClassName="border-transparent text-muted hover:text-foreground"
        />
      </div>

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
        />
      )}
    </div>
  );
}
