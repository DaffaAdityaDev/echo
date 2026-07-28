"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Clock,
  Database,
  Eye,
  FileText,
  FlaskConical,
  Layers,
  RefreshCw,
  ScrollText,
  Shield,
} from "lucide-react";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/Button";
import type { MaturityDimensionKey, MaturityLevel } from "../../types";

export interface StudioDashboardProps {
  promptCount: number;
  maturityLevel?: MaturityLevel;
  weakestDimension?: MaturityDimensionKey;
  roadmapProgress?: { completed: number; total: number };
  isLoading: boolean;
  error: Error | null;
  onRefresh?: () => void;
}

export function StudioDashboard({
  promptCount,
  maturityLevel = "L2",
  weakestDimension = "skills",
  roadmapProgress = { completed: 1, total: 7 },
  isLoading,
  error,
  onRefresh,
}: StudioDashboardProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-10 border border-rose-200 bg-rose-50 rounded-xs text-center max-w-lg mx-auto mt-12 space-y-4 font-mono">
        <div className="p-3 bg-rose-100 border border-rose-200 text-rose-600 rounded-xs">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">Failed to load telemetry</h4>
          <p className="text-xs text-muted mt-1 max-w-md">
            {error?.message || "An unexpected error occurred while fetching studio telemetry."}
          </p>
        </div>
        {onRefresh && (
          <Button variant="secondary" size="sm" onClick={onRefresh} className="gap-2 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry Connection
          </Button>
        )}
      </div>
    );
  }

  const cards = [
    {
      title: "Playground & Sandbox",
      value: "Multi-Model",
      icon: FlaskConical,
      description: "Side-by-side prompt testing & mocking",
      href: "/playground",
    },
    {
      title: "Prompt Library",
      value: promptCount,
      icon: ScrollText,
      description: "Versioned prompt templates managed",
      href: "/prompts",
    },
  ];

  const problemItems = [
    {
      num: "01",
      title: "Chained Attack Techniques",
      desc: "Attackers combine exploits across layers, testing holistic defenses rather than isolated controls.",
      icon: AlertTriangle,
    },
    {
      num: "02",
      title: "Guardrail Limitations",
      desc: "Static rules miss novel combinations and evolving tactics that outpace updates.",
      icon: Eye,
    },
    {
      num: "03",
      title: "MCP Server Opacity",
      desc: "Tool definition changes bypass gateways without visibility or revalidation.",
      icon: Database,
    },
    {
      num: "04",
      title: "Rapid Industry Evolution",
      desc: "Limited red team capacity struggles to match attackers' pace in crafting sophisticated injections.",
      icon: Clock,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-12 font-mono text-foreground pb-16">
      {/* Top Navbar / Header Bar */}
      <header className="flex items-center justify-between py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border border-gb-blue bg-blue-50 flex items-center justify-center rounded-xs">
            <Shield className="h-3.5 w-3.5 text-gb-blue" />
          </div>
          <span className="font-bold text-sm tracking-tight text-foreground">Guardbase</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-[11px] font-semibold text-muted tracking-wider uppercase">
          <span className="hover:text-foreground cursor-pointer flex items-center gap-1">
            Products <ChevronDown className="h-3 w-3" />
          </span>
          <span className="hover:text-foreground cursor-pointer">Company</span>
          <span className="hover:text-foreground cursor-pointer">Blog</span>
          <span className="hover:text-foreground cursor-pointer">Docs</span>
        </nav>
        <Link href="/docs" className="gb-btn-primary text-[10px] py-1.5 px-3">
          VIEW DOCS âŽ˜
        </Link>
      </header>

      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-4">
        <div className="lg:col-span-7 space-y-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter text-foreground leading-[1.08]">
            AI{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gb-bright-blue to-gb-blue">
              deserves
            </span>{" "}
            the same security{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gb-bright-blue to-gb-periwinkle">
              as software.
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-muted max-w-lg leading-relaxed">
            Monitor how agents behave, what attackers could exploit, and which risks actually matter.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <Link
              href="/docs"
              className="px-5 py-2.5 rounded-xs bg-white border border-border text-foreground text-[11px] font-semibold tracking-[0.06em] uppercase hover:bg-surface hover:border-slate-300 transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <span>VIEW DOCS</span>
              <FileText className="h-3.5 w-3.5 text-muted" />
            </Link>
          </div>
        </div>

        {/* Generative Mountain Halftone Graphic Right Column */}
        <div className="lg:col-span-5 relative flex items-center justify-center p-4">
          <div className="w-full h-64 sm:h-72 border border-border bg-surface rounded-xs relative overflow-hidden flex items-end justify-end p-4">
            <svg viewBox="0 0 400 240" className="w-full h-full text-gb-bright-blue/40" fill="none">
              <pattern id="dot-matrix" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="currentColor" opacity="0.4" />
              </pattern>
              <pattern id="dot-dense" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1" fill="#2563eb" opacity="0.75" />
              </pattern>
              {/* Mountain silhouettes */}
              <polygon points="0,240 120,120 220,190 310,80 400,240" fill="url(#dot-matrix)" />
              <polygon points="180,240 280,100 350,150 400,60 400,240" fill="url(#dot-dense)" />
              <path
                d="M0,240 L120,120 L220,190 L310,80 L400,240"
                stroke="#3b82f6"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            </svg>
            <div className="absolute top-3 left-3 text-[10px] text-muted tracking-wider uppercase font-semibold">
              // THREAT TOPOLOGY MATRIX
            </div>
          </div>
        </div>
      </section>

      {/* Grid Divider with Crosshair Markers */}
      <div className="relative border-t border-border crosshair-container" />

      {/* Trusted Logos Strip */}
      <section className="space-y-4">
        <div className="text-[11px] font-semibold tracking-[0.10em] text-muted uppercase flex items-center gap-2">
          <span className="text-gb-blue">â– </span> TRUSTED BY SECURITY TEAMS AT
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 items-center py-4 border-y border-dashed border-border">
          {["Logoipsum", "Logoipsum", "Logoipsum", "logoipsum", "logoipsum", "logoipsum"].map((brand, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-2 text-xs font-bold text-muted tracking-tight opacity-75 hover:opacity-100 transition-opacity"
            >
              <div className="w-4 h-4 rounded-[1px] bg-foreground flex items-center justify-center text-white text-[9px] font-mono">
                {i % 2 === 0 ? "â—†" : "â–²"}
              </div>
              <span>{brand}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Grid Divider with Crosshair Markers */}
      <div className="relative border-t border-border crosshair-container" />

      {/* The Problem Section (01-04 Numbered Rows) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-4">
        <div className="lg:col-span-5 space-y-4">
          <div className="text-[11px] font-semibold tracking-[0.10em] text-muted uppercase flex items-center gap-2">
            <span className="text-gb-blue">â– </span> THE PROBLEM
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            What Keeps Security Teams Up At Night
          </h2>
          <p className="text-xs text-muted leading-relaxed max-w-md">
            Enterprises deploy robust controlsâ€”guardrails, identities, authorizations, data restrictionsâ€”but
            attackers expose gaps.
          </p>
        </div>

        <div className="lg:col-span-7 space-y-0 divide-y divide-dotted divide--slate-300">
          {problemItems.map((item) => (
            <div key={item.num} className="py-5 flex items-start justify-between gap-4 group">
              <div className="flex items-start gap-4">
                <span className="text-xs font-bold text-muted pt-0.5">{item.num}</span>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground group-hover:text-gb-blue transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted max-w-lg leading-relaxed">{item.desc}</p>
                </div>
              </div>
              <div className="gb-icon-bracket shrink-0 bg-white group-hover:border-gb-bright-blue group-hover:bg-blue-50 group-hover:text-gb-blue text-slate-400">
                <item.icon className="h-4 w-4" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Grid Divider with Crosshair Markers */}
      <div className="relative border-t border-border crosshair-container" />

      {/* LLMOps Studio Telemetry & AI Maturity Section */}
      <section className="space-y-6 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.10em] text-muted uppercase flex items-center gap-2">
              <span className="text-gb-blue">â– </span> LLMOPS SYSTEM TELEMETRY
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground mt-1">
              Active Security & Governance Pillars
            </h2>
          </div>
        </div>

        {/* AI-Ready Maturity Model Banner Widget */}
        <Link href="/maturity" className="block group">
          <div className="border border-gb-bright-blue/40 bg-blue-50/60 group-hover:bg-blue-50 rounded-xs p-5 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer relative overflow-hidden shadow-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-xs bg-gb-blue text-white">
                  <Layers className="h-3.5 w-3.5" />
                </span>
                <h3 className="text-sm font-bold text-foreground">AI-Ready System Maturity Model</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-gb-blue text-white">
                  {maturityLevel}
                </span>
              </div>
              <p className="text-xs text-muted max-w-xl">
                Pattern-agnostic evaluation across 7 dimensions (Tools, Skills, Prompts, Security, Data Models,
                Observability, Documentation).
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <div className="text-xs text-amber-600 font-semibold flex items-center gap-1 justify-end">
                  <AlertTriangle className="h-3.5 w-3.5" /> Weakest: {weakestDimension}
                </div>
                <div className="text-[10px] text-muted mt-0.5">
                  Roadmap: {roadmapProgress.completed}/{roadmapProgress.total} L4 milestones
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-gb-blue group-hover:translate-x-1 transition-transform">
                View Matrix & Diagnostic <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </Link>

        {/* Telemetry Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card) => (
            <Link key={card.title} href={card.href} className="block group">
              <div className="border border-border bg-white rounded-xs p-5 group-hover:border-gb-bright-blue group-hover:shadow-md transition-all duration-200 space-y-3 cursor-pointer h-full flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="gb-icon-bracket text-gb-blue bg-blue-50 border-gb-bright-blue">
                      <card.icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-muted uppercase tracking-wider group-hover:text-gb-blue">
                      Explore â†’
                    </span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {isLoading ? (
                        <span className="inline-block h-7 w-16 bg-border rounded-xs animate-pulse" />
                      ) : (
                        card.value
                      )}
                    </div>
                    <div className="text-xs font-bold text-foreground uppercase tracking-wide mt-1">{card.title}</div>
                    <p className="text-xs text-muted mt-0.5 leading-relaxed">{card.description}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
