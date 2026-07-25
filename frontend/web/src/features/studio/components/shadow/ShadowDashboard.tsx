"use client"

import { ShadowComparisonTable } from "./ShadowComparisonTable"
import { EmptyState } from "../shared/EmptyState"
import type { ShadowRun, PromptTemplate } from "../../types"

interface ShadowDashboardProps {
  templates: PromptTemplate[]
  effectiveTemplateId: string | null
  shadowRuns: ShadowRun[]
  isLoading: boolean
  onSelectTemplate: (id: string) => void
}

export function ShadowDashboard({
  templates,
  effectiveTemplateId,
  shadowRuns,
  isLoading,
  onSelectTemplate,
}: ShadowDashboardProps) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Shadow Testing</h1>
        <p className="text-sm text-zinc-500 mt-1">Compare live vs candidate prompt performance on real traffic.</p>
      </div>

      {/* Template selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-zinc-500 mr-1">Template:</span>
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelectTemplate(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              effectiveTemplateId === t.id
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:border-zinc-300"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-zinc-100 rounded-xl animate-pulse" />)}</div>
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
