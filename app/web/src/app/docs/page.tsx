"use client";

import { ArrowRight, BookOpen, Code, Shield, Terminal } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useSpec } from "@/components/docs/OpenApiSpecProvider";

export default function DocsLanding() {
  return (
    <div className="space-y-12 max-w-4xl font-mono">
      {/* Hero */}
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xs bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider mb-3">
          Platform Architecture & API Specs
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground uppercase">Echo Platform API</h1>
        <p className="text-xs text-muted mt-2 leading-relaxed">
          Build autonomous AI agent experiences. This documentation covers authentication, endpoint reference,
          integration patterns, and best practices for the Echo Orchestrator API.
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuickLinkCard
          icon={<Terminal size={18} />}
          title="Quick Start"
          description="Get your first API call running in minutes"
          href="/docs/quickstart"
        />
        <QuickLinkCard
          icon={<BookOpen size={18} />}
          title="API Reference"
          description="Complete endpoint documentation with schemas and examples"
          href="/docs/reference"
        />
        <QuickLinkCard
          icon={<Code size={18} />}
          title="Integration Guides"
          description="Authentication, sessions, settings batching, HITL missions"
          href="/docs/guides/authentication"
        />
        <QuickLinkCard
          icon={<Shield size={18} />}
          title="Error Codes"
          description="HTTP status codes and troubleshooting"
          href="/docs/troubleshooting"
        />
      </div>

      {/* Base URL Info */}
      <div className="p-5 border border-border bg-white rounded-xs space-y-3 crosshair-container shadow-xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Base URL</h2>
        <p className="text-xs text-muted leading-relaxed">
          All API requests should be made to the Echo backend gateway. The development base URL is:
        </p>
        <div className="bg-slate-900 border border-slate-800 rounded-xs p-3 font-mono text-xs text-blue-400 w-fit select-all">
          http://localhost:8080/api/v1
        </div>
        <p className="text-[11px] text-muted">
          All endpoints require Bearer JWT or API Key authentication unless explicitly marked as public.
        </p>
      </div>

      {/* Spec Summary */}
      <SpecSummary />

      {/* Getting Started Steps */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          Next Steps
        </h2>
        <div className="space-y-3">
          <Step number={1} title="Authenticate">
            Obtain a JWT token via{" "}
            <Link href="/docs/reference#tag-Auth" className="text-blue-600 font-bold hover:underline">
              POST /auth/login
            </Link>{" "}
            or use an API key for server-to-server integration.
          </Step>
          <Step number={2} title="Load Configuration (Batching)">
            Fetch initial settings via{" "}
            <Link href="/docs/guides/settings" className="text-blue-600 font-bold hover:underline">
              GET /settings
            </Link>{" "}
            to retrieve default models and harness feature toggles in a single roundtrip.
          </Step>
          <Step number={3} title="Send a Chat Message">
            Stream AI responses via{" "}
            <Link href="/docs/reference#tag-Chat" className="text-blue-600 font-bold hover:underline">
              POST /chat
            </Link>{" "}
            with SSE event streaming for real-time agent interactions.
          </Step>
          <Step number={4} title="Handle HITL Approval">
            For protected tools, handle the human-in-the-loop approval flow via mission approve/deny endpoints.
          </Step>
        </div>
      </div>
    </div>
  );
}

function QuickLinkCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 p-5 border border-border bg-white rounded-xs hover:border-blue-500 hover:bg-slate-50/50 transition-all shadow-xs crosshair-container"
    >
      <div className="gb-icon-bracket text-blue-600 shrink-0">{icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-foreground group-hover:text-blue-600 transition-colors uppercase tracking-tight">
            {title}
          </h3>
          <ArrowRight size={13} className="text-muted group-hover:text-blue-600 transition-colors" />
        </div>
        <p className="text-[11px] text-muted mt-1 leading-normal font-mono">{description}</p>
      </div>
    </Link>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 p-4 border border-border bg-white rounded-xs shadow-xs font-mono">
      <div className="w-7 h-7 rounded-xs bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-blue-600 font-mono">{number}</span>
      </div>
      <div>
        <h3 className="text-xs font-bold text-foreground mb-1 uppercase tracking-tight">{title}</h3>
        <p className="text-xs text-muted leading-relaxed font-mono">{children}</p>
      </div>
    </div>
  );
}

function SpecSummary() {
  const { spec, loading, error } = useSpec();

  if (loading) {
    return (
      <div className="p-5 border border-border bg-white rounded-xs animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-32 mb-3" />
        <div className="h-3 bg-slate-200 rounded w-64" />
      </div>
    );
  }

  if (error || !spec) return null;

  const totalEndpoints = spec.tags.reduce((sum, t) => sum + t.endpoints.length, 0);

  return (
    <div className="p-5 border border-border bg-white rounded-xs space-y-3 shadow-xs font-mono">
      <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">API Specification Summary</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Endpoints" value={String(totalEndpoints)} />
        <Metric label="Tags" value={String(spec.tags.length)} />
        <Metric label="Schemas" value={String(Object.keys(spec.definitions).length)} />
        <Metric label="Version" value={spec.info.version} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 border border-border/80 bg-slate-50/50 rounded-xs">
      <div className="text-base font-bold font-mono text-blue-600">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}
