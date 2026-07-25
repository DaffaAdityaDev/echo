"use client"

import React from "react"
import { Play, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface VariableSlot {
  key: string
  value: string
}

interface PromptEditorProps {
  prompt: string
  variables: VariableSlot[]
  selectedModels: string[]
  availableModels: string[]
  onPromptChange: (val: string) => void
  onVariablesChange: (vars: VariableSlot[]) => void
  onModelsChange: (models: string[]) => void
  onRun: () => void
  isRunning: boolean
}

const DEFAULT_MODELS = ["gpt-4o", "claude-3-5-sonnet-latest", "gpt-4o-mini"]

export function PromptEditor({
  prompt, variables, selectedModels, availableModels,
  onPromptChange, onVariablesChange, onModelsChange, onRun, isRunning,
}: PromptEditorProps) {
  const handleAddVariable = () => {
    onVariablesChange([...variables, { key: "", value: "" }])
  }

  const handleVariableChange = (idx: number, field: "key" | "value", val: string) => {
    const next = [...variables]
    next[idx] = { ...next[idx], [field]: val }
    onVariablesChange(next)
  }

  const handleRemoveVariable = (idx: number) => {
    onVariablesChange(variables.filter((_, i) => i !== idx))
  }

  const toggleModel = (model: string) => {
    if (selectedModels.includes(model)) {
      onModelsChange(selectedModels.filter(m => m !== model))
    } else {
      onModelsChange([...selectedModels, model])
    }
  }

  return (
    <div className="space-y-4">
      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder="Write your system prompt here... Use {{variable_name}} for dynamic slots."
        rows={10}
        className="w-full p-4 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-800 placeholder:text-zinc-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/10 resize-y"
      />

      {/* Variables */}
      {variables.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Mock Variables</h4>
          {variables.map((v, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 w-4">{'\u007B\u007B'}</span>
              <input
                value={v.key}
                onChange={(e) => handleVariableChange(idx, "key", e.target.value)}
                placeholder="variable_name"
                className="flex-1 h-8 px-3 rounded-lg bg-white border border-zinc-200 text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
              />
              <span className="text-xs text-zinc-500">→</span>
              <input
                value={v.value}
                onChange={(e) => handleVariableChange(idx, "value", e.target.value)}
                placeholder="mock value"
                className="flex-[2] h-8 px-3 rounded-lg bg-white border border-zinc-200 text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
              />
              <button onClick={() => handleRemoveVariable(idx)} className="text-zinc-500 hover:text-red-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button onClick={handleAddVariable} className="text-xs text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1">
        <Plus className="h-3.5 w-3.5" /> Add Variable
      </button>

      {/* Model selection */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-zinc-500 mr-1">Models:</span>
        {(availableModels.length > 0 ? availableModels : DEFAULT_MODELS).map((model) => (
          <button
            key={model}
            onClick={() => toggleModel(model)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedModels.includes(model)
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-zinc-100 text-zinc-700 border-zinc-300 hover:bg-zinc-200 hover:border-zinc-400"
            }`}
          >
            {model}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={onRun}
          isLoading={isRunning}
          disabled={!prompt.trim() || selectedModels.length === 0}
          variant="primary"
          size="lg"
          className="!bg-blue-600 !text-white !border-blue-600 hover:!bg-blue-700"
        >
          <Play className="h-4 w-4" /> Run Test
        </Button>
      </div>
    </div>
  )
}
