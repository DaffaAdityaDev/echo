"use client"

import { useState } from "react"
import { useCreateDataset, useRunEval } from "../api/useEvals"
import type { TestCase, EvalRun } from "../types"

export function useEvalSuite() {
  const [evalRun, setEvalRun] = useState<EvalRun | null>(null)
  const [error, setError] = useState<string | null>(null)

  const createDataset = useCreateDataset()
  const runEval = useRunEval()

  const handleRun = async (promptVersionId: string, datasetId: string) => {
    setError(null)
    setEvalRun(null)
    try {
      const result = await runEval.mutateAsync({ prompt_version_id: promptVersionId, dataset_id: datasetId })
      setEvalRun(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eval run failed")
    }
  }

  return {
    evalRun,
    isRunning: runEval.isPending,
    error,
    onRun: handleRun,
  }
}
