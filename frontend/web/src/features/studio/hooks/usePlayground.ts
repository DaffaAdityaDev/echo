"use client"

import { api } from "@/lib/api-client"
import { useStudioStore } from "../stores/studioStore"
import type { PlaygroundResult } from "../types"

export function usePlayground() {
  const {
    playgroundPrompt: prompt,
    playgroundVariables: variables,
    selectedModels,
    playgroundResults: results,
    isPlaygroundRunning: isRunning,
    setPlaygroundPrompt: setPrompt,
    setPlaygroundVariables: setVariables,
    setSelectedModels,
    setPlaygroundResults: setResults,
    setIsPlaygroundRunning: setIsRunning,
  } = useStudioStore()

  const handleRun = async () => {
    if (!prompt.trim() || selectedModels.length === 0) return

    setIsRunning(true)
    setResults([])

    try {
      const data = await api.post<{ results: PlaygroundResult[] }>("/studio/playground", {
        prompt,
        variables,
        models: selectedModels,
      })
      setResults(data.results ?? null)
    } catch (err) {
      setResults([
        {
          model: "Error",
          content: "",
          latency_ms: 0,
          tokens: 0,
          error: err instanceof Error ? err.message : "Request failed",
        },
      ])
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
    error: null,
    handleRun,
  }
}
