"use client"

import React from 'react'
import { CodeBlock } from '@/components/docs/CodeBlock'
import { useSpec } from '@/components/docs/OpenApiSpecProvider'
import { EndpointDetail } from '@/components/docs/EndpointDetail'

export default function SessionsGuide() {
  const { spec } = useSpec()
  const sessionEndpoints = spec?.tags
    .flatMap((t) => t.endpoints)
    .filter((ep) => ep.tags.includes('Sessions'))

  return (
    <div className="space-y-12 max-w-4xl font-mono">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">
          Session Management
        </h1>
        <p className="text-xs text-muted mt-2 leading-relaxed font-mono">
          Sessions maintain conversation context across multiple chat requests. Each session stores
          message history, context summaries, and metadata.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          Basic Usage
        </h2>
        <p className="text-xs text-muted leading-relaxed font-mono">
          Create a session, then pass the <code className="text-blue-600 font-bold">sessionId</code> in subsequent chat requests
          to maintain conversation continuity:
        </p>
        <CodeBlock
          language="python"
          code={`import requests

BASE = "http://localhost:8080/api/v1"
HEADERS = {"Authorization": "Bearer <token>", "Content-Type": "application/json"}

# 1. Create a session
session = requests.post(f"{BASE}/sessions", headers=HEADERS,
    json={"title": "My Chat Session"}).json()
session_id = session["id"]

# 2. Send a message with the session
response = requests.post(f"{BASE}/chat", headers=HEADERS,
    json={"message": "Hello!", "sessionId": session_id}, stream=True)

# 3. Send follow-up (automatic context from session)
response = requests.post(f"{BASE}/chat", headers=HEADERS,
    json={"message": "What did I just say?", "sessionId": session_id}, stream=True)

# 4. Get session messages
messages = requests.get(f"{BASE}/sessions/{session_id}/messages",
    headers=HEADERS).json()
print(messages["messages"])`}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          Session Lifecycle
        </h2>
        <div className="space-y-3 text-xs text-muted leading-relaxed font-mono">
          <div className="flex gap-4 p-4 border border-border bg-white rounded-xs shadow-xs crosshair-container">
            <div className="w-7 h-7 rounded-xs bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-blue-600 font-mono">1</span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground mb-1 uppercase tracking-tight">Create</h3>
              <p className="text-xs text-muted">POST /sessions — Creates a new session with an optional title.</p>
            </div>
          </div>
          <div className="flex gap-4 p-4 border border-border bg-white rounded-xs shadow-xs crosshair-container">
            <div className="w-7 h-7 rounded-xs bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-emerald-600 font-mono">2</span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground mb-1 uppercase tracking-tight">Use</h3>
              <p className="text-xs text-muted">Include sessionId in chat requests. The agent builds context from previous messages.</p>
            </div>
          </div>
          <div className="flex gap-4 p-4 border border-border bg-white rounded-xs shadow-xs crosshair-container">
            <div className="w-7 h-7 rounded-xs bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-amber-600 font-mono">3</span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground mb-1 uppercase tracking-tight">Update</h3>
              <p className="text-xs text-muted">PATCH /sessions/{'{id}'} — Update title or context summary.</p>
            </div>
          </div>
          <div className="flex gap-4 p-4 border border-border bg-white rounded-xs shadow-xs crosshair-container">
            <div className="w-7 h-7 rounded-xs bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-rose-600 font-mono">4</span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground mb-1 uppercase tracking-tight">Delete</h3>
              <p className="text-xs text-muted">DELETE /sessions/{'{id}'} — Permanently remove session and messages.</p>
            </div>
          </div>
        </div>
      </section>

      {sessionEndpoints && (
        <section className="space-y-4">
          <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
            Session Endpoints
          </h2>
          {sessionEndpoints.map((ep) => (
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

