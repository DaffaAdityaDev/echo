"use client"

import React from 'react'
import { CodeBlock } from '@/components/docs/CodeBlock'
import { Info, Rocket } from 'lucide-react'

export default function QuickStartPage() {
  return (
    <div className="space-y-12 max-w-4xl font-mono">
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xs bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider mb-3">
          <Rocket size={12} /> 5-Minute Onboarding
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">Quick Start Guide</h1>
        <p className="text-xs text-muted mt-2 leading-relaxed">
          Get up and running with the Echo Orchestrator API in under 5 minutes.
        </p>
      </div>

      {/* Step 1 */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          1. Get Your Credentials
        </h2>
        <p className="text-xs text-muted leading-relaxed">
          Every API request requires authentication. You can authenticate using either a JWT token (for user-facing apps)
          or an API key (for server-to-server integration).
        </p>
        <p className="text-xs text-muted leading-relaxed">
          To get started, log in via the{' '}
          <a href="/login" className="text-blue-600 font-bold hover:underline">web interface</a> or call the login endpoint directly:
        </p>
        <CodeBlock
          language="bash"
          code={`curl -X POST http://localhost:8080/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "your@email.com", "password": "your-password"}'`}
        />
        <p className="text-xs text-muted">
          The response includes a <code className="text-blue-600 font-bold">token</code> field — this is your JWT bearer token.
        </p>
      </section>

      {/* Step 2 */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          2. Batch Load Configuration (Best Practice)
        </h2>
        <p className="text-xs text-muted leading-relaxed">
          Fetch initial user settings and harness guard module configuration in a single request:
        </p>
        <CodeBlock
          language="bash"
          code={`curl -X GET http://localhost:8080/api/v1/settings \\
  -H "Authorization: Bearer <your-token>"`}
        />
      </section>

      {/* Step 3 */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          3. Send Your First Chat Message
        </h2>
        <p className="text-xs text-muted leading-relaxed">
          Send a message and receive a real-time SSE (Server-Sent Events) stream:
        </p>
        <CodeBlock
          language="bash"
          code={`curl -X POST http://localhost:8080/api/v1/chat \\
  -H "Authorization: Bearer <your-token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "What can you do?",
    "model": "gpt-4o",
    "mode": "agent"
  }'`}
        />
        <p className="text-xs text-muted">
          The response is an SSE stream. Each event contains a JSON payload with fields like <code className="text-blue-600 font-semibold">type</code>,{' '}
          <code className="text-blue-600 font-semibold">content</code>, and <code className="text-blue-600 font-semibold">usage</code>.
        </p>
      </section>

      {/* Step 4 */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          4. Parse the SSE Stream
        </h2>
        <p className="text-xs text-muted leading-relaxed">
          The SSE stream delivers structured events. Here is how to parse it in different languages:
        </p>

        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">JavaScript / TypeScript</h3>
        <CodeBlock
          language="typescript"
          code={`const response = await fetch("http://localhost:8080/api/v1/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: "Explain quantum computing",
    model: "gpt-4o",
    mode: "agent",
  }),
})

const reader = response.body!.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  const chunk = decoder.decode(value, { stream: true })
  for (const line of chunk.split("\\n")) {
    if (line.startsWith("data: ")) {
      const payload = JSON.parse(line.slice(6))
      console.log(payload.type, payload.content)
    }
  }
}`}
        />

        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Python</h3>
        <CodeBlock
          language="python"
          code={`import requests
import json

response = requests.post(
    "http://localhost:8080/api/v1/chat",
    headers={
        "Authorization": "Bearer <token>",
        "Content-Type": "application/json",
    },
    json={"message": "Explain quantum computing", "mode": "agent"},
    stream=True,
)

for line in response.iter_lines():
    if line:
        decoded = line.decode("utf-8")
        if decoded.startswith("data: "):
            payload = json.loads(decoded[6:])
            print(payload.get("type"), payload.get("content"))`}
        />
      </section>

      {/* Info box */}
      <div className="p-4 border border-border bg-slate-50/80 rounded-xs flex gap-3.5 font-mono shadow-xs">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-muted space-y-1">
          <p><strong className="text-foreground uppercase tracking-wider text-[11px]">Next steps:</strong></p>
          <p>• Browse the <a href="/docs/reference" className="text-blue-600 font-bold hover:underline">API Reference</a> for all available endpoints</p>
          <p>• Learn about <a href="/docs/guides/authentication" className="text-blue-600 font-bold hover:underline">authentication methods</a></p>
          <p>• Understand <a href="/docs/guides/settings" className="text-blue-600 font-bold hover:underline">Settings Batching & Harness Toggles</a></p>
          <p>• Set up <a href="/docs/guides/sessions" className="text-blue-600 font-bold hover:underline">sessions</a> for persistent conversations</p>
        </div>
      </div>
    </div>
  )
}

