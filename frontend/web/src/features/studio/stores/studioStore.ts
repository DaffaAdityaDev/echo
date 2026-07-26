"use client"

import { create } from 'zustand'
import type { PlaygroundResult } from '../types'

interface StudioState {
  playgroundResults: PlaygroundResult[] | null
  isPlaygroundRunning: boolean
  activePromptId: string | null
  playgroundPrompt: string
  playgroundVariables: Record<string, string>
  selectedModels: string[]
  selectedFeatures: string[]
  selectedSkills: string[]
  playgroundError: string | null
  streamingContent: Record<string, string>
  streamingReasoning: Record<string, string>
  setPlaygroundResults: (results: PlaygroundResult[] | null) => void
  setIsPlaygroundRunning: (running: boolean) => void
  setActivePromptId: (id: string | null) => void
  setPlaygroundPrompt: (prompt: string) => void
  setPlaygroundVariables: (vars: Record<string, string>) => void
  setSelectedModels: (models: string[]) => void
  setSelectedFeatures: (features: string[]) => void
  setSelectedSkills: (skills: string[]) => void
  setPlaygroundError: (error: string | null) => void
  setStreamingContent: (content: Record<string, string>) => void
  addStreamingChunk: (model: string, chunk: string) => void
  setStreamingReasoning: (content: Record<string, string>) => void
  addReasoningChunk: (model: string, chunk: string) => void
}

export const useStudioStore = create<StudioState>((set) => ({
  playgroundResults: null,
  isPlaygroundRunning: false,
  activePromptId: null,
  playgroundPrompt: '',
  playgroundVariables: {},
  selectedModels: [],
  selectedFeatures: [],
  selectedSkills: [],
  playgroundError: null,
  streamingContent: {},
  streamingReasoning: {},
  setPlaygroundResults: (results) => set({ playgroundResults: results }),
  setIsPlaygroundRunning: (running) => set({ isPlaygroundRunning: running }),
  setActivePromptId: (id) => set({ activePromptId: id }),
  setPlaygroundPrompt: (prompt) => set({ playgroundPrompt: prompt }),
  setPlaygroundVariables: (vars) => set({ playgroundVariables: vars }),
  setSelectedModels: (models) => set({ selectedModels: models }),
  setSelectedFeatures: (features) => set({ selectedFeatures: features }),
  setSelectedSkills: (skills) => set({ selectedSkills: skills }),
  setPlaygroundError: (error) => set({ playgroundError: error }),
  setStreamingContent: (content) => set({ streamingContent: content }),
  addStreamingChunk: (model, chunk) => set((state) => ({
    streamingContent: {
      ...state.streamingContent,
      [model]: (state.streamingContent[model] || '') + chunk,
    },
  })),
  setStreamingReasoning: (content) => set({ streamingReasoning: content }),
  addReasoningChunk: (model, chunk) => set((state) => ({
    streamingReasoning: {
      ...state.streamingReasoning,
      [model]: (state.streamingReasoning[model] || '') + chunk,
    },
  })),
}))
