"use client";

import React from "react";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function ExamplesPage() {
  return (
    <div className="space-y-12 max-w-4xl font-mono">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">Integration Examples</h1>
        <p className="text-xs text-muted mt-2 leading-relaxed font-mono">
          Code examples in multiple languages for common Echo API operations.
        </p>
      </div>

      <section id="curl" className="space-y-4 scroll-mt-24">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          cURL
        </h2>

        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Login</h3>
        <CodeBlock
          language="bash"
          code={`curl -X POST http://localhost:8080/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "password123"}'`}
        />

        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mt-6">Chat Stream</h3>
        <CodeBlock
          language="bash"
          code={`curl -X POST http://localhost:8080/api/v1/chat \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello!", "model": "gpt-4o", "mode": "agent"}'`}
        />

        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mt-6">List Sessions</h3>
        <CodeBlock
          language="bash"
          code={`curl -X GET http://localhost:8080/api/v1/sessions \\
  -H "Authorization: Bearer <token>"`}
        />

        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mt-6">Approve HITL</h3>
        <CodeBlock
          language="bash"
          code={`curl -X POST http://localhost:8080/api/v1/missions/{id}/approve \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"approvalId": "appr_id", "decision": "approve"}'`}
        />

        <h3 className="text-xs font-bold uppercase tracking-wider text-muted mt-6">Update Settings</h3>
        <CodeBlock
          language="bash"
          code={`curl -X PUT http://localhost:8080/api/v1/settings \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"default_mode": "agent", "default_model": "gpt-4o"}'`}
        />
      </section>

      <section id="python" className="space-y-4 scroll-mt-24">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          Python
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

      <section id="nodejs" className="space-y-4 scroll-mt-24">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          Node.js / TypeScript
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
  );
}
