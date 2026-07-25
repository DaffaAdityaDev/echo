"use client"

import React, { useState } from "react"
import { ClipboardCheck, Play, Clock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { DatasetUploader } from "./DatasetUploader"
import { EvalScoreCard } from "./EvalScoreCard"
import type { TestCase, EvalRun } from "../../types"

export interface EvalDashboardProps {
  evalRun: EvalRun | null
  isRunning: boolean
  error: string | null
  onRun: (promptVersionId: string, datasetId: string) => Promise<void>
}

export function EvalDashboard({ evalRun, isRunning, error, onRun }: EvalDashboardProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [promptVersionId, setPromptVersionId] = useState("")

  const handleUpload = async (cases: TestCase[]) => {
    setTestCases(cases)
    setName(`Dataset ${new Date().toLocaleDateString()}`)
  }

  const handleRun = () => {
    if (!promptVersionId.trim() || !datasetId) return
    onRun(promptVersionId, datasetId)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Eval Suite</h1>
        <p className="text-sm text-zinc-400 mt-1">Automatically grade your prompts against test datasets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Dataset upload */}
          <div className="border border-zinc-800/60 bg-zinc-900/20 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> Dataset
            </h3>
            <DatasetUploader onUpload={handleUpload} isUploading={false} />
            {testCases.length > 0 && (
              <div className="text-xs text-zinc-400">
                Loaded <span className="text-zinc-200 font-semibold">{testCases.length}</span> test cases
              </div>
            )}
          </div>

          {/* Run config */}
          <div className="border border-zinc-800/60 bg-zinc-900/20 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Prompt Version ID</label>
                <input
                  value={promptVersionId}
                  onChange={(e) => setPromptVersionId(e.target.value)}
                  placeholder="uuid of the prompt version to test"
                  className="w-full h-9 px-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <Button
                onClick={handleRun}
                isLoading={isRunning}
                disabled={!promptVersionId.trim() || !datasetId || testCases.length === 0}
                className="gap-2 w-full"
              >
                <Play className="h-4 w-4" /> Run Eval Suite
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-xl px-4 py-3 border border-red-500/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {isRunning && (
            <div className="border border-zinc-800/60 bg-zinc-900/20 rounded-2xl p-5 text-center space-y-3">
              <Clock className="h-6 w-6 text-blue-400 mx-auto animate-spin" />
              <div className="text-sm text-zinc-400">Running evaluation...</div>
            </div>
          )}
          {evalRun && !isRunning && (
            <EvalScoreCard evalRun={evalRun} isLoading={false} />
          )}
          {!evalRun && !isRunning && !error && (
            <div className="flex flex-col items-center justify-center h-64 border border-zinc-800/60 bg-zinc-900/20 rounded-2xl text-center space-y-2">
              <ClipboardCheck className="h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-500">Upload a dataset and run eval to see results.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
