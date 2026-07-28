"use client";

import { usePromptTemplates } from "../api/usePrompts";
import { useMaturityModel } from "./useMaturityModel";

export function useStudioDashboard() {
  const promptsQuery = usePromptTemplates();
  const maturity = useMaturityModel();

  const promptCount = promptsQuery.data?.templates?.length ?? 0;

  const isLoading = promptsQuery.isLoading;
  const error = promptsQuery.error;

  return {
    promptCount,
    maturityLevel: maturity.echoAssessment.overallLevel,
    weakestDimension: maturity.echoAssessment.weakestDimension,
    maturityDimensions: maturity.dimensions,
    roadmapProgress: {
      completed: maturity.roadmap.filter((r) => r.status === "completed").length,
      total: maturity.roadmap.length,
    },
    isLoading,
    error,
    onRefresh: () => {
      promptsQuery.refetch();
    },
  };
}
