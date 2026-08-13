"use client";

import { useMemo, useState } from "react";
import {
  ECHO_SELF_ASSESSMENT_ROADMAP,
  MATURITY_DIMENSIONS,
  MATURITY_LEVELS,
  SCORING_QUESTIONS,
} from "../data/maturity-data";
import type {
  ClientAssessmentScore,
  ClientCompanyAssessment,
  MaturityDimension,
  MaturityDimensionKey,
  MaturityLevel,
  RoadmapItem,
  SystemMaturityAssessment,
} from "../types";

const LEVEL_WEIGHTS: Record<MaturityLevel, number> = {
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
  L5: 5,
};

const WEIGHT_TO_LEVEL: Record<number, MaturityLevel> = {
  1: "L1",
  2: "L2",
  3: "L3",
  4: "L4",
  5: "L5",
};

// Starter evidence placeholders for a new client assessment; the user edits
// these per dimension in the assessment tool before scoring.
const DEFAULT_CLIENT_EVIDENCE: Record<MaturityDimensionKey, string> = {
  tools: "Standard REST endpoints, no tool schemas.",
  skills: "Ad-hoc prompt strings embedded in controllers.",
  prompts: "String concatenation without validation.",
  security: "Basic auth token header.",
  data: "Prose documentation of database tables.",
  observability: "Raw console logging.",
  documentation: "Manual markdown files.",
};

const today = (): string => new Date().toISOString().split("T")[0];

function findWeakestLink(scores: Record<MaturityDimensionKey, MaturityLevel>): {
  minWeight: number;
  weakest: MaturityDimensionKey;
} {
  const keys = Object.keys(scores) as MaturityDimensionKey[];
  let minWeight = LEVEL_WEIGHTS.L5;
  let weakest: MaturityDimensionKey = keys[0] ?? "skills";
  for (const key of keys) {
    const weight = LEVEL_WEIGHTS[scores[key]];
    if (weight < minWeight) {
      minWeight = weight;
      weakest = key;
    }
  }
  return { minWeight, weakest };
}

export function useMaturityModel() {
  const [activeTab, setActiveTab] = useState<"matrix" | "scoring" | "roadmap" | "client">("matrix");
  const [clientName, setClientName] = useState("");
  const [clientScores, setClientScores] = useState<Record<MaturityDimensionKey, MaturityLevel>>({
    tools: "L2",
    skills: "L1",
    prompts: "L2",
    security: "L2",
    data: "L2",
    observability: "L1",
    documentation: "L1",
  });
  const [clientEvidences, setClientEvidences] = useState<Record<MaturityDimensionKey, string>>(DEFAULT_CLIENT_EVIDENCE);

  const [roadmap, setRoadmap] = useState<RoadmapItem[]>(
    ECHO_SELF_ASSESSMENT_ROADMAP.map((item) => ({ ...item })) as RoadmapItem[],
  );

  const [questionAnswers, setQuestionAnswers] = useState<Record<string, boolean>>({
    "q-tools-1": true,
    "q-tools-2": false,
    "q-tools-3": false,
    "q-skills-1": false,
    "q-skills-2": false,
    "q-prompts-1": true,
    "q-prompts-2": false,
    "q-sec-1": true,
    "q-sec-2": false,
    "q-data-1": true,
    "q-obs-1": true,
    "q-obs-2": false,
    "q-doc-1": true,
  });

  // Calculate internal assessment using Weakest Link Rule
  const echoAssessment = useMemo<SystemMaturityAssessment>(() => {
    const scores = Object.fromEntries(MATURITY_DIMENSIONS.map((dim) => [dim.key, dim.currentLevel])) as Record<
      MaturityDimensionKey,
      MaturityLevel
    >;
    const { minWeight, weakest } = findWeakestLink(scores);

    return {
      overallLevel: WEIGHT_TO_LEVEL[minWeight] || "L2",
      weakestDimension: weakest,
      dimensions: Object.fromEntries(MATURITY_DIMENSIONS.map((dim) => [dim.key, { ...dim }])) as Record<
        MaturityDimensionKey,
        MaturityDimension
      >,
      lastAssessedAt: today(),
    };
  }, []);

  // Calculate client company overall level using Weakest Link Rule
  const clientAssessment = useMemo<ClientCompanyAssessment>(() => {
    const { minWeight, weakest } = findWeakestLink(clientScores);

    const scoresMap = Object.fromEntries(
      (Object.keys(clientScores) as MaturityDimensionKey[]).map((key) => [
        key,
        {
          dimension: key,
          level: clientScores[key],
          evidence: clientEvidences[key] || "No evidence provided",
          quickestL3Action: `Upgrade ${key} to L3 (Structured) schemas and contracts`,
        } satisfies ClientAssessmentScore,
      ]),
    ) as Record<MaturityDimensionKey, ClientAssessmentScore>;

    return {
      clientName: clientName || "Sample Client Corp",
      assessedAt: today(),
      overallLevel: WEIGHT_TO_LEVEL[minWeight] || "L1",
      weakestDimension: weakest,
      scores: scoresMap,
    };
  }, [clientName, clientScores, clientEvidences]);

  const toggleQuestion = (qId: string) => {
    setQuestionAnswers((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const setClientScore = (dimension: MaturityDimensionKey, level: MaturityLevel) => {
    setClientScores((prev) => ({
      ...prev,
      [dimension]: level,
    }));
  };

  const setClientEvidence = (dimension: MaturityDimensionKey, text: string) => {
    setClientEvidences((prev) => ({
      ...prev,
      [dimension]: text,
    }));
  };

  const toggleRoadmapStatus = (id: string) => {
    setRoadmap((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextStatus =
          item.status === "completed" ? "planned" : item.status === "planned" ? "in_progress" : "completed";
        return { ...item, status: nextStatus };
      }),
    );
  };

  return {
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
    levelsInfo: MATURITY_LEVELS,
    dimensions: MATURITY_DIMENSIONS,
    questions: SCORING_QUESTIONS,
  };
}
