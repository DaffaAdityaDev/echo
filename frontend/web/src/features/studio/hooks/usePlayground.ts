"use client"

import { api } from "@/lib/api-client"
import { STUDIO_ENDPOINTS } from "../constants"
import { useStudioStore } from "../stores/studioStore"
import { useFeatures } from "@/features/shared/hooks/useFeatures"
import { useSkills } from "@/features/shared/hooks/useSkills"
import type { PlaygroundResult } from "../types"
import { finalizeModel } from "./playground-utils"

interface StreamEvent {
  model: string
  content?: string
  reasoning?: string
  event: "started" | "content" | "reasoning" | "done" | "error" | "complete"
  error?: string
  latency_ms?: number
  tokens?: number
}

export function usePlayground() {
  const {
    playgroundPrompt: prompt,
    playgroundVariables: variables,
    selectedModels,
    selectedFeatures,
    selectedSkills,
    playgroundResults: results,
    isPlaygroundRunning: isRunning,
    playgroundError: error,
    streamingContent,
    streamingReasoning,
    setPlaygroundPrompt: setPrompt,
    setPlaygroundVariables: setVariables,
    setSelectedModels,
    setSelectedFeatures,
    setSelectedSkills,
    setPlaygroundResults: setResults,
    setIsPlaygroundRunning: setIsRunning,
    setPlaygroundError: setError,
    setStreamingContent,
    addStreamingChunk,
    setStreamingReasoning,
    addReasoningChunk,
  } = useStudioStore()

  const { features: allFeatures, isLoading: featuresLoading } = useFeatures()
  const { skills: allSkills, isLoading: skillsLoading } = useSkills()

  const handleRun = async () => {
    if (!prompt.trim() || selectedModels.length === 0) return

    setIsRunning(true)
    setResults(null)
    setStreamingContent({})
    setStreamingReasoning({})
    setError(null)

    const completed = new Map<string, PlaygroundResult>()

    try {
      await api.stream<StreamEvent>(
        STUDIO_ENDPOINTS.PLAYGROUND,
        { prompt, variables, models: selectedModels, features: selectedFeatures, skills: selectedSkills },
        (data) => {
          const streamState = useStudioStore.getState()
          switch (data.event) {
            case "content":
              addStreamingChunk(data.model, data.content || "")
              break
            case "reasoning":
              addReasoningChunk(data.model, data.reasoning || "")
              break
            case "done":
              finalizeModel(completed, data.model, {
                content: data.content ?? streamState.streamingContent[data.model] ?? "",
                reasoning: data.reasoning ?? streamState.streamingReasoning[data.model] ?? undefined,
                latency_ms: data.latency_ms || 0,
                tokens: data.tokens || 0,
              }, streamState, { setStreamingContent, setStreamingReasoning, setResults })
              break
            case "started":
              break
            case "error":
              finalizeModel(completed, data.model, {
                error: data.error,
              }, streamState, { setStreamingContent, setStreamingReasoning, setResults })
              break
          }
        }
      )
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
    selectedFeatures,
    setSelectedFeatures,
    selectedSkills,
    setSelectedSkills,
    allFeatures,
    allSkills,
    featuresLoading,
    skillsLoading,
    results,
    isRunning,
    error,
    streamingContent,
    streamingReasoning,
    handleRun,
  }
}
