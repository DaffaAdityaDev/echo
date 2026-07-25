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
  playgroundError: string | null
  setPlaygroundResults: (results: PlaygroundResult[] | null) => void
  setIsPlaygroundRunning: (running: boolean) => void
  setActivePromptId: (id: string | null) => void
  setPlaygroundPrompt: (prompt: string) => void
  setPlaygroundVariables: (vars: Record<string, string>) => void
  setSelectedModels: (models: string[]) => void
  setPlaygroundError: (error: string | null) => void
}

export const useStudioStore = create<StudioState>((set) => ({
  playgroundResults: null,
  isPlaygroundRunning: false,
  activePromptId: null,
  playgroundPrompt: '',
  playgroundVariables: {},
  selectedModels: [],
  playgroundError: null,
  setPlaygroundResults: (results) => set({ playgroundResults: results }),
  setIsPlaygroundRunning: (running) => set({ isPlaygroundRunning: running }),
  setActivePromptId: (id) => set({ activePromptId: id }),
  setPlaygroundPrompt: (prompt) => set({ playgroundPrompt: prompt }),
  setPlaygroundVariables: (vars) => set({ playgroundVariables: vars }),
  setSelectedModels: (models) => set({ selectedModels: models }),
  setPlaygroundError: (error) => set({ playgroundError: error }),
}))
