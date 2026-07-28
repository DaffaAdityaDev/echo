"use client"

import React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CodeBlock } from '@/components/docs/CodeBlock'
import { ArrowLeft, Terminal, Code } from 'lucide-react'

export default function LanguageExamplePage() {
  const params = useParams()
  const lang = ((params?.lang as string) || 'curl').toLowerCase()

  if (lang === 'python') {
    return (
      <div className="space-y-8 max-w-4xl font-mono">
        <div>
          <Link
            href="/docs/examples"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-blue-600 transition-colors mb-4"
          >
            <ArrowLeft size={14} /> All Examples
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-xs bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
              Python SDK
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase mt-2">
            Python Integration Example
          </h1>
          <p className="text-xs text-muted mt-2 leading-relaxed font-mono">
            Complete Python client implementation for SSE chat streaming, session management, and HITL approvals using <code className="text-blue-600 font-bold">requests</code>.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
            Python Client Implementation
          </h2>
          <CodeBlock
            language="python"
            code={`import requests
import json

BASE = "http://localhost:8080/api/v1"

class EchoClient:
    def __init__(self, token):
        self.headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def chat_stream(self, message, model="gpt-4o", mode="agent", session_id=None):
        payload = {"message": message, "model": model, "mode": mode}
        if session_id:
            payload["sessionId"] = session_id

        response = requests.post(f"{BASE}/chat", headers=self.headers,
                                 json=payload, stream=True)

        for line in response.iter_lines():
            if line:
                text = line.decode("utf-8")
                if text.startswith("data: "):
                    yield json.loads(text[6:])

    def create_session(self, title="New Chat"):
        return requests.post(f"{BASE}/sessions", headers=self.headers,
                             json={"title": title}).json()

    def get_messages(self, session_id):
        resp = requests.get(f"{BASE}/sessions/{session_id}/messages",
                            headers=self.headers)
        return resp.json().get("messages", [])

    def approve_hitl(self, mission_id, approval_id, reason=None):
        payload = {"approvalId": approval_id, "decision": "approve"}
        if reason:
            payload["reason"] = reason
        return requests.post(f"{BASE}/missions/{mission_id}/approve",
                             headers=self.headers, json=payload)

# Usage
client = EchoClient(token="<your-token>")
for event in client.chat_stream("Explain quantum computing"):
    if event["type"] == "content":
        print(event["content"], end="")
    elif event["type"] == "error":
        print(f"\\nError: {event['content']}")`}
          />
        </section>
      </div>
    )
  }

  if (lang === 'nodejs' || lang === 'typescript' || lang === 'node') {
    return (
      <div className="space-y-8 max-w-4xl font-mono">
        <div>
          <Link
            href="/docs/examples"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-blue-600 transition-colors mb-4"
          >
            <ArrowLeft size={14} /> All Examples
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-xs bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
              Node.js / TypeScript
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase mt-2">
            Node.js / TypeScript Integration Example
          </h1>
          <p className="text-xs text-muted mt-2 leading-relaxed font-mono">
            Native Fetch API streaming client with TypeScript type definitions for SSE event handling.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
            Node.js / TypeScript Client Implementation
          </h2>
          <CodeBlock
            language="typescript"
            code={`const BASE = "http://localhost:8080/api/v1";

interface StreamEvent {
  type: string;
  content?: string;
  [key: string]: unknown;
}

class EchoClient {
  private headers: Record<string, string>;

  constructor(token: string) {
    this.headers = {
      Authorization: \`Bearer \${token}\`,
      "Content-Type": "application/json",
    };
  }

  async *chatStream(
    message: string,
    options?: { model?: string; mode?: string; sessionId?: string }
  ): AsyncGenerator<StreamEvent> {
    const payload: Record<string, unknown> = {
      message,
      model: options?.model ?? "gpt-4o",
      mode: options?.mode ?? "agent",
    };
    if (options?.sessionId) payload.sessionId = options.sessionId;

    const response = await fetch(\`\${BASE}/chat\`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\\n")) {
        if (line.startsWith("data: ")) {
          yield JSON.parse(line.slice(6));
        }
      }
    }
  }

  async createSession(title = "New Chat") {
    const res = await fetch(\`\${BASE}/sessions\`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ title }),
    });
    return res.json();
  }
}

// Usage
const client = new EchoClient("<your-token>");
for await (const event of client.chatStream("Hello!")) {
  if (event.type === "content") process.stdout.write(event.content!);
}`}
          />
        </section>
      </div>
    )
  }

  // Default: cURL
  return (
    <div className="space-y-8 max-w-4xl font-mono">
      <div>
        <Link
          href="/docs/examples"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-blue-600 transition-colors mb-4"
        >
          <ArrowLeft size={14} /> All Examples
        </Link>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-xs bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
            cURL CLI
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase mt-2">
          cURL API Examples
        </h1>
        <p className="text-xs text-muted mt-2 leading-relaxed font-mono">
          Command line HTTP examples for common Echo API operations.
        </p>
      </div>

      <section className="space-y-6">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">1. Authentication / Login</h3>
          <CodeBlock language="bash" code={`curl -X POST http://localhost:8080/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "password123"}'`} />
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">2. Chat Stream</h3>
          <CodeBlock language="bash" code={`curl -X POST http://localhost:8080/api/v1/chat \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!", "model": "gpt-4o", "mode": "agent"}'`} />
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">3. List Sessions</h3>
          <CodeBlock language="bash" code={`curl -X GET http://localhost:8080/api/v1/sessions \\
  -H "Authorization: Bearer <token>"`} />
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">4. Approve HITL Mission</h3>
          <CodeBlock language="bash" code={`curl -X POST http://localhost:8080/api/v1/missions/{id}/approve \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"approvalId": "appr_id", "decision": "approve"}'`} />
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">5. Update Settings</h3>
          <CodeBlock language="bash" code={`curl -X PUT http://localhost:8080/api/v1/settings \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"default_mode": "agent", "default_model": "gpt-4o"}'`} />
        </div>
      </section>
    </div>
  )
}
