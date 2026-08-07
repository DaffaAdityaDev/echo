"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { QUERY_STANDARD } from "@/lib/query-standard";
import { STUDIO_QUERY_KEYS } from "../constants";
import { studioApi } from "../services/studio-api";
import { useStudioStore } from "../stores/studioStore";
import type { SystemMaturityAssessment } from "../types";

export function useMaturityAssessment() {
  const setMaturity = useStudioStore((s) => s.setMaturity);
  const query = useQuery<SystemMaturityAssessment>({
    queryKey: STUDIO_QUERY_KEYS.MATURITY,
    queryFn: studioApi.getMaturity,
    ...QUERY_STANDARD,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (query.data) {
      setMaturity(query.data);
    }
  }, [query.data, setMaturity]);

  return query;
}

export function useSaveClientAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: studioApi.saveClientAssessment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STUDIO_QUERY_KEYS.MATURITY });
    },
  });
}
