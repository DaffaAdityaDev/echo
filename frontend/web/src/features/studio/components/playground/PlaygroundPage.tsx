"use client"

import React from "react"
import { FlaskConical } from "lucide-react"
import { useModels } from "@/features/chat/hooks/useModels"
import { PromptEditor } from "./PromptEditor"
import { ModelComparisonGrid } from "./ModelComparisonGrid"
import type { usePlayground } from "../../hooks/usePlayground"

type Props = ReturnType<typeof usePlayground>

export function PlaygroundPage(props: Props) {
  const {
    prompt, setPrompt,
    variables, setVariables,
    selectedModels, setSelectedModels,
    results, isRunning, error,
    handleRun,
  } = props

  const { models } = useModels()
  const availableModels = models.map((m) => m.id)
  const variableSlots = Object.entries(variables).map(([key, value]) => ({ key, value }))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Playground</h1>
        <p className="text-sm text-zinc-500 mt-1">Test your prompts against multiple models side-by-side.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="border border-zinc-200 bg-zinc-50 rounded-2xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Prompt</h3>
            <PromptEditor
              prompt={prompt}
              variables={variableSlots}
              selectedModels={selectedModels}
              availableModels={availableModels}
              onPromptChange={setPrompt}
              onVariablesChange={(slots) => {
                const obj: Record<string, string> = {}
                slots.forEach(s => { if (s.key) obj[s.key] = s.value })
                setVariables(obj)
              }}
              onModelsChange={setSelectedModels}
              onRun={handleRun}
              isRunning={isRunning}
            />
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Output</h3>
            {error && <span className="text-xs text-red-600 ml-auto">{error}</span>}
          </div>
          {!results && !isRunning && (
            <div className="flex flex-col items-center justify-center h-64 border border-zinc-200 bg-zinc-50 rounded-2xl text-center space-y-2">
              <FlaskConical className="h-8 w-8 text-zinc-400" />
              <p className="text-sm text-zinc-500">Write a prompt and run a test to see results.</p>
            </div>
          )}
          <ModelComparisonGrid results={results ?? []} isLoading={isRunning} />
        </div>
      </div>
    </div>
  )
}
