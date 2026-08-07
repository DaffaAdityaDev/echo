"use client";

import { Info, Key, Shield } from "lucide-react";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function AuthGuide() {
  return (
    <div className="space-y-12 max-w-4xl font-mono">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">Authentication</h1>
        <p className="text-xs text-muted mt-2 leading-relaxed font-mono">
          Echo API supports two authentication methods: JWT bearer tokens for user-facing applications and long-lived
          API keys for server-to-server integration.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight flex items-center gap-2">
          <Shield size={16} className="text-blue-600" /> JWT Token Authentication
        </h2>
        <p className="text-xs text-muted leading-relaxed font-mono">
          For interactive applications, obtain a JWT by calling the login endpoint:
        </p>
        <CodeBlock
          language="bash"
          code={`curl -X POST http://localhost:8080/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "your-password"}'`}
        />
        <p className="text-xs text-muted">
          Response includes a <code className="text-blue-600 font-bold">token</code> field. Include this in all
          subsequent requests:
        </p>
        <CodeBlock language="http" code={`Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`} />
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight flex items-center gap-2">
          <Key size={16} className="text-amber-600" /> API Key Authentication
        </h2>
        <p className="text-xs text-muted leading-relaxed font-mono">
          For automated or server-side integrations, create an API key via the admin console or admin API endpoint. API
          keys are long-lived and scoped to specific permissions.
        </p>
        <div className="p-4 border border-border bg-slate-50/80 rounded-xs flex gap-3.5 shadow-xs">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-muted">
            API key management requires admin privileges. Use the Admin Console at{" "}
            <code className="text-blue-600 font-bold">/admin</code> or the Admin API endpoints.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          Authentication Header Format
        </h2>
        <p className="text-xs text-muted leading-relaxed font-mono">
          All authenticated endpoints require the <code className="text-blue-600 font-bold">Authorization</code> header:
        </p>
        <CodeBlock
          language="http"
          code={`# Using JWT Token
Authorization: Bearer <your-jwt-token>

# Using API Key
Authorization: Bearer <your-api-key>`}
        />
        <p className="text-xs text-muted font-mono">
          Unauthenticated requests to protected endpoints return a{" "}
          <span className="text-rose-600 font-bold">401 Unauthorized</span> status.
        </p>
      </section>
    </div>
  );
}
