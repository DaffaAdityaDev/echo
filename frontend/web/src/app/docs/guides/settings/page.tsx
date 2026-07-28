"use client"

import React from 'react'
import { CodeBlock } from '@/components/docs/CodeBlock'
import { useSpec } from '@/components/docs/OpenApiSpecProvider'
import { EndpointDetail } from '@/components/docs/EndpointDetail'
import { Info, CheckCircle2, ShieldCheck, Zap } from 'lucide-react'

export default function SettingsGuide() {
  const { spec } = useSpec()
  const settingsEndpoints = spec?.tags
    .flatMap((t) => t.endpoints)
    .filter((ep) => ep.tags.includes('Settings'))

  return (
    <div className="space-y-12 max-w-4xl font-mono">
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xs bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider mb-3">
          <ShieldCheck size={12} /> Integration & Architecture Guide
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">
          Settings & Configuration
        </h1>
        <p className="text-xs text-muted mt-2 leading-relaxed">
          Manage user preferences, default features, skills, models, and harness feature toggles
          through the Settings API.
        </p>
      </div>

      {/* User Settings Overview */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          User Settings Schema
        </h2>
        <p className="text-xs text-muted leading-relaxed">
          Each user has configurable preferences stored centrally that control default behavior across all sessions:
        </p>
        <div className="overflow-x-auto border border-border bg-white rounded-xs shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">Field</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">Type</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              <tr className="hover:bg-slate-50/50"><td className="px-4 py-2.5 font-mono text-blue-600 font-semibold">default_mode</td><td className="px-4 py-2.5 text-purple-600">string</td><td className="px-4 py-2.5 text-muted">agent | standard | nlah | react</td></tr>
              <tr className="hover:bg-slate-50/50"><td className="px-4 py-2.5 font-mono text-blue-600 font-semibold">default_model</td><td className="px-4 py-2.5 text-purple-600">string</td><td className="px-4 py-2.5 text-muted">LLM model ID (e.g. gpt-4o)</td></tr>
              <tr className="hover:bg-slate-50/50"><td className="px-4 py-2.5 font-mono text-blue-600 font-semibold">default_features</td><td className="px-4 py-2.5 text-purple-600">array&lt;string&gt;</td><td className="px-4 py-2.5 text-muted">Enabled feature IDs (web-browsing, code-interpreter)</td></tr>
              <tr className="hover:bg-slate-50/50"><td className="px-4 py-2.5 font-mono text-blue-600 font-semibold">default_skills</td><td className="px-4 py-2.5 text-purple-600">array&lt;string&gt;</td><td className="px-4 py-2.5 text-muted">Active skill IDs</td></tr>
              <tr className="hover:bg-slate-50/50"><td className="px-4 py-2.5 font-mono text-blue-600 font-semibold">harness_toggles</td><td className="px-4 py-2.5 text-purple-600">object</td><td className="px-4 py-2.5 text-muted">Feature toggles for harness guard modules</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Harness Feature Toggles */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          Harness Feature Toggles
        </h2>
        <p className="text-xs text-muted leading-relaxed">
          The <code className="text-blue-600 font-bold bg-slate-100 px-1 py-0.5 rounded-xs border border-border">harness_toggles</code> object controls granular guard module execution. Each module can be independently enabled or configured:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ['loopDetection', 'Detect and break infinite identical execution loops'],
            ['budgetMonitor', 'Enforce step limits, timeouts, and cost caps'],
            ['systemNotices', 'Emit system notices & warnings via SSE stream'],
            ['hitlGuard', 'Human-in-the-loop protection for high-risk tools'],
            ['contextOptimization', 'Manage prompt compaction & context window'],
          ].map(([name, desc]) => (
            <div key={name} className="p-4 border border-border bg-white rounded-xs crosshair-container">
              <h3 className="text-xs font-bold text-blue-600 font-mono">{name}</h3>
              <p className="text-[11px] text-muted mt-1 leading-normal">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BEST PRACTICE ARCHITECTURE SECTION */}
      <section className="space-y-4 border-l-2 border-blue-600 pl-4 py-1">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-600" />
          <h2 className="text-base font-bold text-foreground uppercase tracking-tight">
            Best Practice: Load Config Batching vs. Per-Module Loading
          </h2>
        </div>
        
        <div className="p-4 border border-blue-200 bg-blue-50/50 rounded-xs text-xs space-y-3">
          <p className="font-bold text-blue-900">
            Is loading config one-by-one per module a best practice?
          </p>
          <p className="text-slate-700 leading-relaxed">
            <strong className="text-blue-800">No. Centralized batch loading is the recommended best practice.</strong> Fetching or updating configuration item-by-item (or endpoint-by-endpoint) creates unnecessary network roundtrips, risks state inconsistency, and slows down initialization.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-white border border-slate-200 rounded-xs space-y-1">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block flex items-center gap-1">
                <CheckCircle2 size={12} /> Best Practice: Single Batch Endpoint
              </span>
              <p className="text-[11px] text-slate-600 leading-normal">
                Load full user preferences & harness toggles via <code className="text-blue-600 font-semibold">GET /api/v1/settings</code> during app startup, and save changes via <code className="text-blue-600 font-semibold">PUT /api/v1/settings</code>.
              </p>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-xs space-y-1">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                Per-Request Dynamic Overrides
              </span>
              <p className="text-[11px] text-slate-600 leading-normal">
                Use per-request <code className="text-blue-600 font-semibold">config</code> payload in <code className="text-blue-600 font-semibold">POST /api/v1/chat</code> only when overriding default settings temporarily for a single request.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Code Implementation Examples */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          Implementation Examples (Batch Settings)
        </h2>

        {/* Python */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Python (requests)</h3>
          <CodeBlock
            language="python"
            code={`import requests

BASE_URL = "http://localhost:8080/api/v1"
HEADERS = {"Authorization": "Bearer <token>", "Content-Type": "application/json"}

# 1. Load full configuration in single batch request
def load_app_config():
    res = requests.get(f"{BASE_URL}/settings", headers=HEADERS)
    res.raise_for_status()
    return res.json()

# 2. Update full settings payload cleanly
def update_harness_config():
    payload = {
        "default_mode": "agent",
        "default_model": "gpt-4o",
        "default_features": ["web-browsing", "code-interpreter"],
        "harness_toggles": {
            "loopDetection": {"enabled": True, "maxConsecutiveIdenticalCalls": 3},
            "budgetMonitor": {"enabled": True, "maxSteps": 20, "maxCostUsd": 2.0},
            "hitlGuard": {"enabled": True, "protectedTools": ["delete_file", "execute_sql_write"]},
        },
    }
    res = requests.put(f"{BASE_URL}/settings", headers=HEADERS, json=payload)
    print("Settings updated:", res.status_code)`}
          />
        </div>

        {/* TypeScript / JS */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">TypeScript / Node.js (fetch)</h3>
          <CodeBlock
            language="typescript"
            code={`const BASE_URL = "http://localhost:8080/api/v1";
const HEADERS = {
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
};

// Batch fetch settings on client app init
async function initUserSettings() {
  const response = await fetch(\`\${BASE_URL}/settings\`, { headers: HEADERS });
  const settings = await response.json();
  return settings;
}

// Single-payload settings update
async function saveHarnessToggles(toggles: Record<string, any>) {
  const response = await fetch(\`\${BASE_URL}/settings\`, {
    method: "PUT",
    headers: HEADERS,
    body: JSON.stringify({ harness_toggles: toggles }),
  });
  return response.ok;
}`}
          />
        </div>
      </section>

      {/* Info Notice */}
      <div className="p-4 border border-border bg-slate-50/80 rounded-xs flex gap-3.5 items-start">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-muted leading-relaxed">
          Settings are persisted per authenticated user account. Updates to <code className="text-blue-600">harness_toggles</code> immediately take effect across all new agent execution sessions.
        </p>
      </div>

      {/* Endpoints Detail */}
      {settingsEndpoints && (
        <section className="space-y-4">
          <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
            Settings API Endpoints
          </h2>
          {settingsEndpoints.map((ep) => (
            <EndpointDetail
              key={`${ep.method}-${ep.path}`}
              endpoint={ep}
              baseUrl="http://localhost:8080/api/v1"
              definitions={spec?.definitions}
            />
          ))}
        </section>
      )}
    </div>
  )
}

