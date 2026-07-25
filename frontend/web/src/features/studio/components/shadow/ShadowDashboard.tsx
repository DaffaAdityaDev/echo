"use client"

import React from "react"
import { usePromptTemplates } from "../../api/usePrompts"
import { useShadowHistory } from "../../api/useShadow"
import { ShadowComparisonTable } from "./ShadowComparisonTable"
import { EmptyState } from "../shared/EmptyState"
import { Eye } from "lucide-react"

export function ShadowDashboard() {
  const templatesQuery = usePromptTemplates()
  const templates = templatesQuery.data?.templates ?? []
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string | null>(null)

  const shadowQuery = useShadowHistory(selectedTemplateId)
  const shadowRuns = shadowQuery.data?.shadow_runs ?? []

  // Auto-select first template with shadow data
  React.useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(templates[0].id)
    }
  }, [templates, selectedTemplateId])

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Shadow Testing</h1>
        <p className="text-sm text-zinc-400 mt-1">Compare live vs candidate prompt performance on real traffic.</p>
      </div>

      {/* Template selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-zinc-400 mr-1">Template:</span>
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTemplateId(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              selectedTemplateId === t.id
                ? "bg-blue-600/15 text-blue-400 border-blue-500/30"
                : "bg-zinc-800/40 text-zinc-500 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {shadowQuery.isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-zinc-900/40 rounded-xl animate-pulse" />)}</div>
      ) : shadowRuns.length === 0 ? (
        <EmptyState
          title="No shadow runs yet"
          description="Shadow testing activates when a prompt version has 'shadow' status and traffic is flowing."
          action={null}
        />
      ) : (
        <ShadowComparisonTable shadowRuns={shadowRuns} />
      )}
    </div>
  )
}
