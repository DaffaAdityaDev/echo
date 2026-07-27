"use client"

import React from "react"
import { FlaskConical, Bug } from "lucide-react"
import { useModels } from "@/features/chat/hooks/useModels"
import { PromptEditor } from "./PromptEditor"
import { FeatureSkillPicker } from "./FeatureSkillPicker"
import { ModelComparisonGrid } from "./ModelComparisonGrid"
import { AgentExecutionTree } from "../debug/AgentExecutionTree"
import { StatusDashboard } from "../debug/StatusDashboard"
import { TokenCostMeter } from "../debug/TokenCostMeter"
import { ToolTimeline } from "../debug/ToolTimeline"
import { ThoughtTrace } from "../debug/ThoughtTrace"
import { DebugPromptPanel } from "../debug/DebugPromptPanel"
import { DEBUG_TABS } from "../../constants"
import type { usePlayground } from "../../hooks/usePlayground"

type Props = ReturnType<typeof usePlayground>

export function PlaygroundPage(props: Props) {
  const {
    prompt, setPrompt,
    variables, setVariables,
    selectedModels, setSelectedModels,
    selectedFeatures, setSelectedFeatures,
    selectedSkills, setSelectedSkills,
    allFeatures, allSkills,
    featuresLoading, skillsLoading,
    results, isRunning: modelRunRunning, error,
    streamingContent,
    streamingReasoning,
    handleRun,
    debugMode,
    debugAgentTree, debugToolCalls, debugStateChanges,
    debugDegradationLevel, debugMissionState,
    debugTotalCost, debugMaxIterations,
    debugContent, debugReasoning, debugIsRunning,
    debugError, debugInfo,
    debugAgentStatus, debugMissionMeta, debugCumulativeUsage,
    handleDebugRun, handleToggleDebug,
    activeTab, setActiveTab,
    thoughtTraceOpen, openThoughtTrace, closeThoughtTrace,
  } = props

  const { models } = useModels()
  const availableModels = models.map((m) => m.id)
  const variableSlots = Object.entries(variables).map(([key, value]) => ({ key, value }))

  const isRunning = debugMode ? debugIsRunning : modelRunRunning

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Playground</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {debugMode ? 'Debug mode — full agent execution visualization.' : 'Test your prompts against multiple models side-by-side.'}
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Bug className={`h-4 w-4 ${debugMode ? 'text-amber-500' : 'text-zinc-400'}`} />
          <span className={`text-xs font-semibold ${debugMode ? 'text-amber-600' : 'text-zinc-500'}`}>Debug</span>
          <input
            type="checkbox"
            checked={debugMode}
            onChange={handleToggleDebug}
            className="sr-only"
          />
          <div className={`w-9 h-5 rounded-full transition-colors ${debugMode ? 'bg-amber-500' : 'bg-zinc-300'}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow-sm mt-0.5 transition-transform ${debugMode ? 'translate-x-4 ml-0.5' : 'ml-0.5'}`} />
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-zinc-200 bg-zinc-50 rounded-2xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Prompt</h3>
            <PromptEditor
              prompt={prompt}
              variables={variableSlots}
              selectedModels={debugMode ? selectedModels.slice(0, 1) : selectedModels}
              availableModels={availableModels}
              onPromptChange={setPrompt}
              onVariablesChange={(slots) => {
                const obj: Record<string, string> = {}
                slots.forEach(s => { if (s.key) obj[s.key] = s.value })
                setVariables(obj)
              }}
              onModelsChange={setSelectedModels}
              onRun={debugMode ? handleDebugRun : handleRun}
              isRunning={isRunning}
            />
            <div className="border-t border-zinc-200 mt-4 pt-4">
              <FeatureSkillPicker
                features={allFeatures}
                skills={allSkills}
                selectedFeatures={selectedFeatures}
                selectedSkills={selectedSkills}
                onFeaturesChange={setSelectedFeatures}
                onSkillsChange={setSelectedSkills}
                isLoading={featuresLoading || skillsLoading}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {debugMode ? (
            <>
              <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
                {DEBUG_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                {debugIsRunning && (
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-zinc-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Running
                  </span>
                )}
              </div>

              {debugError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{debugError}</div>
              )}

              {activeTab === 'output' && (
                <div className="space-y-3">
                  {debugReasoning && (
                    <details className="border border-amber-200 bg-amber-50/50 rounded-2xl overflow-hidden">
                      <summary className="text-xs font-semibold text-amber-700 cursor-pointer select-none px-4 py-2.5 hover:bg-amber-100/50">
                        Thinking trace ({debugReasoning.length} chars)
                      </summary>
                      <pre className="text-xs text-amber-700/80 font-mono whitespace-pre-wrap p-4 pt-2 max-h-60 overflow-y-auto">
                        {debugReasoning}
                      </pre>
                    </details>
                  )}
                  {debugContent ? (
                    <pre className="text-xs text-zinc-700 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto border border-zinc-200 bg-zinc-50 rounded-2xl p-4">
                      {debugContent}
                      {debugIsRunning && <span className="inline-block w-1.5 h-3.5 bg-blue-500 animate-pulse ml-0.5" />}
                    </pre>
                  ) : debugIsRunning ? (
                    <div className="flex items-center justify-center h-48 border border-zinc-200 bg-zinc-50 rounded-2xl text-sm text-zinc-400">
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Waiting for response...
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 border border-zinc-200 bg-zinc-50 rounded-2xl text-center space-y-2">
                      <Bug className="h-8 w-8 text-zinc-400" />
                      <p className="text-sm text-zinc-500">Run in debug mode to see execution details.</p>
                    </div>
                  )}

                  {debugToolCalls.filter(t => t.status === 'completed' || t.status === 'failed').length > 0 && (
                    <div className="flex justify-end">
                      <button
                        onClick={openThoughtTrace}
                        className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
                      >
                        View full reasoning trace →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tree' && (
                <AgentExecutionTree tree={debugAgentTree} isRunning={debugIsRunning} />
              )}

              {activeTab === 'timeline' && (
                <ToolTimeline toolCalls={debugToolCalls} isRunning={debugIsRunning} />
              )}

              {activeTab === 'status' && (
                <StatusDashboard
                  agentStatus={debugAgentStatus}
                  degradationLevel={debugDegradationLevel}
                  missionState={debugMissionState}
                  strategy={debugMissionMeta?.strategy}
                  isRunning={debugIsRunning}
                />
              )}

              {activeTab === 'tokens' && (
                <TokenCostMeter
                  cumulativeUsage={debugCumulativeUsage}
                  totalCost={debugTotalCost}
                  maxContextTokens={debugMaxIterations * 10000}
                  maxIterations={debugMaxIterations}
                  currentIteration={debugStateChanges.length}
                  isRunning={debugIsRunning}
                />
              )}

              {activeTab === 'debug' && (
                <DebugPromptPanel debugInfos={debugInfo} isRunning={debugIsRunning} />
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Output</h3>
                {error && <span className="text-xs text-red-600 ml-auto">{error}</span>}
              </div>
              {!results && !modelRunRunning && !error && (
                <div className="flex flex-col items-center justify-center h-64 border border-zinc-200 bg-zinc-50 rounded-2xl text-center space-y-2">
                  <FlaskConical className="h-8 w-8 text-zinc-400" />
                  <p className="text-sm text-zinc-500">Write a prompt and run a test to see results.</p>
                </div>
              )}
              <ModelComparisonGrid results={results ?? []} isLoading={modelRunRunning} streamingContent={streamingContent} streamingReasoning={streamingReasoning} selectedModels={selectedModels} />
            </>
          )}
        </div>
      </div>

      <ThoughtTrace
        reasoning={debugReasoning}
        isOpen={thoughtTraceOpen}
        onClose={closeThoughtTrace}
      />
    </div>
  )
}
