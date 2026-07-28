"use client"

import React from 'react'
import { CodeBlock } from '@/components/docs/CodeBlock'
import { useSpec } from '@/components/docs/OpenApiSpecProvider'
import { EndpointDetail } from '@/components/docs/EndpointDetail'

export default function ChatGuide() {
  const { spec } = useSpec()
  const chatEndpoint = spec?.tags
    .flatMap((t) => t.endpoints)
    .find((ep) => ep.path === '/api/v1/chat' && ep.method === 'post')

  const chatEndpoints = spec?.tags
    .flatMap((t) => t.endpoints)
    .filter((ep) => ep.tags.includes('Chat'))

  return (
    <div className="space-y-12 max-w-4xl font-mono">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">Chat API Integration</h1>
        <p className="text-xs text-muted mt-2 leading-relaxed font-mono">
          The Chat API enables real-time streaming AI conversations via Server-Sent Events (SSE).
          Messages are streamed as structured events containing reasoning, tool calls, and final content.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          SSE Event Types
        </h2>
        <p className="text-xs text-muted leading-relaxed font-mono">
          The chat stream delivers typed events. Each event is a JSON object with a <code className="text-blue-600 font-bold">type</code> field.
        </p>
        <div className="overflow-x-auto border border-border bg-white rounded-xs shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">Event Type</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {[
                ['metadata', 'Mission metadata including strategy, tools, and objective'],
                ['reasoning', 'Model reasoning / chain-of-thought content'],
                ['tool_call', 'Agent invoking a tool with specific parameters'],
                ['tool_result', 'Tool execution result returned to agent'],
                ['subagent_call', 'Sub-agent being spawned for a task'],
                ['subagent_result', 'Sub-agent returning its result'],
                ['content', 'Final response text content'],
                ['usage', 'Token usage statistics for current turn'],
                ['error', 'Error during stream execution'],
                ['system_notice', 'System-level notices (budget, loop detection)'],
                ['hitl_approval_required', 'Human-in-the-loop approval request'],
                ['token_metrics', 'Real-time token consumption metrics'],
                ['heartbeat', 'Keep-alive signal with agent status'],
                ['progress', 'Current iteration step count'],
                ['turn_complete', 'Agent turn completed successfully'],
                ['mission_completed', 'Full mission execution finished'],
              ].map(([type, desc]) => (
                <tr key={type} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-blue-600 font-semibold">{type}</td>
                  <td className="px-4 py-2.5 text-muted font-mono">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          Streaming in Python
        </h2>
        <CodeBlock
          language="python"
          code={`import requests
import json

def stream_chat(message, token, model="gpt-4o", mode="agent"):
    response = requests.post(
        "http://localhost:8080/api/v1/chat",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={"message": message, "model": model, "mode": mode},
        stream=True,
    )

    for line in response.iter_lines():
        if not line:
            continue
        decoded = line.decode("utf-8")
        if decoded.startswith("data: "):
            payload = json.loads(decoded[6:])
            event_type = payload.get("type")

            if event_type == "content":
                print(payload.get("content"), end="", flush=True)
            elif event_type == "reasoning":
                print(f"\\n[Reasoning]: {payload.get('content')}")
            elif event_type == "error":
                print(f"\\n[Error]: {payload.get('content')}")
            elif event_type == "usage":
                usage = payload.get("usage", {})
                print(f"\\n[Tokens: {usage.get('totalTokens', '?')}]")`}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          Streaming in JavaScript
        </h2>
        <CodeBlock
          language="javascript"
          code={`async function streamChat(message, token) {
  const response = await fetch("http://localhost:8080/api/v1/chat", {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${token}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, model: "gpt-4o", mode: "agent" }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    for (const line of text.split("\\n")) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        handleEvent(data);
      }
    }
  }
}

function handleEvent(data) {
  switch (data.type) {
    case "content":
      process.stdout.write(data.content);
      break;
    case "reasoning":
      console.log("\\n[Reasoning]", data.content);
      break;
    case "tool_call":
      console.log("\\n[Tool]", data.toolName, data.toolInput);
      break;
    case "error":
      console.error("\\n[Error]", data.content);
      break;
  }
}`}
        />
      </section>

      {/* Dynamic endpoint card */}
      {chatEndpoint && (
        <section className="space-y-4">
          <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
            Chat Endpoint
          </h2>
          <EndpointDetail
            endpoint={chatEndpoint}
            baseUrl="http://localhost:8080/api/v1"
            definitions={spec?.definitions}
          />
        </section>
      )}

      {chatEndpoints && chatEndpoints.length > 1 && (
        <section className="space-y-4">
          <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
            Related Chat Endpoints
          </h2>
          {chatEndpoints.filter((ep) => !(ep.path === '/api/v1/chat' && ep.method === 'post')).map((ep) => (
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

