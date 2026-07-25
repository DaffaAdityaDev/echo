"use client"

import { api } from "@/lib/api-client"
import { STUDIO_ENDPOINTS } from "../constants"
import { useStudioStore } from "../stores/studioStore"
import type { PlaygroundResult } from "../types"

export function usePlayground() {
  const {
    playgroundPrompt: prompt,
    playgroundVariables: variables,
    selectedModels,
    playgroundResults: results,
    isPlaygroundRunning: isRunning,
    playgroundError: error,
    setPlaygroundPrompt: setPrompt,
    setPlaygroundVariables: setVariables,
    setSelectedModels,
    setPlaygroundResults: setResults,
    setIsPlaygroundRunning: setIsRunning,
    setPlaygroundError: setError,
  } = useStudioStore()

  const handleRun = async () => {
    if (!prompt.trim() || selectedModels.length === 0) return

    setIsRunning(true)
    setResults([])
    setError(null)

    try {
      const data = await api.post<{ results: PlaygroundResult[] }>(STUDIO_ENDPOINTS.PLAYGROUND, {
        prompt,
        variables,
        models: selectedModels,
      })
      setResults(data.results ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setIsRunning(false)
    }
  }

  return {
    prompt,
    setPrompt,
    variables,
    setVariables,
    selectedModels,
    setSelectedModels,
    results,
    isRunning,
    error,
    handleRun,
  }
}
