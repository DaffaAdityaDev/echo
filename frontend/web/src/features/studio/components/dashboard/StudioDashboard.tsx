"use client"

import React from "react"
import Link from "next/link"
import {
  FlaskConical,
  ClipboardCheck,
  ScrollText,
  Eye,
  ShieldAlert,
  AlertCircle,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import type { MaturityLevel, MaturityDimensionKey } from "../../types"

export interface StudioDashboardProps {
  promptCount: number
  evalRunCount: number
  shadowRunCount: number
  auditLogCount: number
  maturityLevel?: MaturityLevel
  weakestDimension?: MaturityDimensionKey
  roadmapProgress?: { completed: number; total: number }
  isLoading: boolean
  error: Error | null
  onRefresh?: () => void
}

export function StudioDashboard({
  promptCount,
  evalRunCount,
  shadowRunCount,
  auditLogCount,
  maturityLevel = "L2",
  weakestDimension = "skills",
  roadmapProgress = { completed: 1, total: 7 },
  isLoading,
  error,
  onRefresh,
}: StudioDashboardProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-10 border border-red-500/20 bg-red-500/5 rounded-2xl text-center max-w-lg mx-auto mt-12 space-y-4">
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">
          <AlertCircle className="h-7 w-7" />
        </div>
        <div>
          <h4 className="text-base font-semibold text-zinc-100">Failed to load studio overview</h4>
          <p className="text-xs text-zinc-400 mt-1 max-w-md">
            {error?.message || "An unexpected error occurred while fetching studio telemetry."}
          </p>
        </div>
        {onRefresh && (
          <Button variant="secondary" size="sm" onClick={onRefresh} className="gap-2 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </Button>
        )}
      </div>
    )
  }

  const cards = [
    {
      title: "Playground & Sandbox",
      value: "Multi-Model",
      icon: FlaskConical,
      description: "Side-by-side prompt testing & mocking",
      href: "/playground",
      color: "text-indigo-400 bg-indigo-500/10",
    },
    {
      title: "Prompt Library",
      value: promptCount,
      icon: ScrollText,
      description: "Versioned prompt templates managed",
      href: "/prompts",
      color: "text-blue-400 bg-blue-500/10",
    },
    {
      title: "Eval Runs",
      value: evalRunCount,
      icon: ClipboardCheck,
      description: "Rule-based & LLM-as-a-Judge suites",
      href: "/evals",
      color: "text-emerald-400 bg-emerald-500/10",
    },
    {
      title: "Shadow Runs",
      value: shadowRunCount,
      icon: Eye,
      description: "Production traffic mirrored for testing",
      href: "/shadow",
      color: "text-purple-400 bg-purple-500/10",
    },
    {
      title: "Audit Events",
      value: auditLogCount,
      icon: ShieldAlert,
      description: "Governance actions recorded",
      href: "/audit",
      color: "text-amber-400 bg-amber-500/10",
    },
  ]

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-100">
            LLMOps User Studio
          </h1>
          <p className="text-xs md:text-sm text-zinc-400 mt-1">
            Test, evaluate, and govern your AI prompts without touching code.
          </p>
        </div>
      </div>

      {/* AI-Ready Maturity Model Banner Widget */}
      <Link href="/maturity" className="block group">
        <div className="border border-blue-500/30 bg-blue-500/5 group-hover:bg-blue-500/10 rounded-2xl p-6 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer relative overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                <Layers className="h-4 w-4" />
              </span>
              <h2 className="text-base font-bold text-zinc-100">AI-Ready System Maturity Model</h2>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {maturityLevel}
              </span>
            </div>
            <p className="text-xs text-zinc-400 max-w-xl">
              Pattern-agnostic evaluation across 7 dimensions (Tools, Skills, Prompts, Security, Data Models, Observability, Documentation).
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-amber-400 font-semibold flex items-center gap-1 justify-end">
                <AlertTriangle className="h-3.5 w-3.5" /> Weakest: {weakestDimension}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                Roadmap: {roadmapProgress.completed}/{roadmapProgress.total} L4 milestones
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition-transform">
              View Matrix & Diagnostic <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </Link>

      {/* 4 Pillars + Governance Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="block">
            <div className="border border-zinc-800/60 bg-zinc-900/30 rounded-2xl p-5 hover:border-zinc-700/80 hover:bg-zinc-900/50 transition-all duration-200 space-y-3 cursor-pointer h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${card.color}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs text-zinc-500 group-hover:text-zinc-300">View Pillar</span>
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-100">
                    {isLoading ? (
                      <span className="inline-block h-8 w-16 bg-zinc-800 rounded animate-pulse" />
                    ) : (
                      card.value
                    )}
                  </div>
                  <div className="text-sm font-semibold text-zinc-300 mt-1">{card.title}</div>
                  <p className="text-xs text-zinc-500 mt-0.5">{card.description}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Start Workflow */}
      <div className="border border-zinc-800/60 bg-zinc-900/20 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-blue-400" />
          LLMOps User Journey Flow
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-zinc-400">
          <div className="space-y-1 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
            <div className="text-zinc-200 font-semibold">1. Playground</div>
            <p>Draft & test system prompts across models with mocked variables.</p>
          </div>
          <div className="space-y-1 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
            <div className="text-zinc-200 font-semibold">2. Eval Suite</div>
            <p>Upload test dataset & run automated assertions + LLM-as-a-Judge.</p>
          </div>
          <div className="space-y-1 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
            <div className="text-zinc-200 font-semibold">3. Shadow Test</div>
            <p>Mirror 5% production traffic silently to candidate version.</p>
          </div>
          <div className="space-y-1 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
            <div className="text-zinc-200 font-semibold">4. Governance</div>
            <p>Approve version promotion or 1-click rollback with audit log.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
