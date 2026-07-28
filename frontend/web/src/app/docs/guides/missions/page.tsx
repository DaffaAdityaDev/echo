"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import React from "react";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { EndpointDetail } from "@/components/docs/EndpointDetail";
import { useSpec } from "@/components/docs/OpenApiSpecProvider";

export default function MissionsGuide() {
  const { spec } = useSpec();
  const missionEndpoints = spec?.tags.flatMap((t) => t.endpoints).filter((ep) => ep.path.includes("/missions/"));

  return (
    <div className="space-y-12 max-w-4xl font-mono">
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xs bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-wider mb-3">
          <ShieldCheck size={12} /> Security & Governance
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">HITL / Missions</h1>
        <p className="text-xs text-muted mt-2 leading-relaxed font-mono">
          Human-in-the-Loop (HITL) approval flow for high-risk tool executions. When the agent encounters a protected
          tool, it pauses and requests human approval before proceeding.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          How It Works
        </h2>
        <div className="space-y-3 text-xs text-muted leading-relaxed font-mono">
          <div className="flex gap-4 p-4 border border-border bg-white rounded-xs shadow-xs crosshair-container">
            <div className="w-7 h-7 rounded-xs bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <ShieldAlert size={14} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground mb-1 uppercase tracking-tight">
                1. HITL Event Triggered
              </h3>
              <p className="text-xs text-muted">
                During execution, the agent emits a{" "}
                <code className="text-blue-600 font-bold bg-slate-100 px-1 py-0.5 rounded-xs border border-border">
                  hitl_approval_required
                </code>{" "}
                SSE event with approval details.
              </p>
            </div>
          </div>
          <div className="flex gap-4 p-4 border border-border bg-white rounded-xs shadow-xs crosshair-container">
            <div className="w-7 h-7 rounded-xs bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-blue-600 font-mono">2</span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground mb-1 uppercase tracking-tight">
                2. Receive Approval Request
              </h3>
              <p className="text-xs text-muted">
                The SSE event contains <code className="text-blue-600 font-bold">approvalId</code>,{" "}
                <code className="text-blue-600 font-bold">toolName</code>,{" "}
                <code className="text-blue-600 font-bold">args</code>, and{" "}
                <code className="text-blue-600 font-bold">riskLevel</code>.
              </p>
            </div>
          </div>
          <div className="flex gap-4 p-4 border border-border bg-white rounded-xs shadow-xs crosshair-container">
            <div className="w-7 h-7 rounded-xs bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-emerald-600 font-mono">3</span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground mb-1 uppercase tracking-tight">3. Approve or Deny</h3>
              <p className="text-xs text-muted">
                POST to approve or deny with the <code className="text-blue-600 font-bold">approvalId</code>. The
                mission resumes with an SSE stream.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          HITL Approval Example
        </h2>
        <p className="text-xs text-muted leading-relaxed font-mono">
          After receiving a <code className="text-blue-600 font-bold">hitl_approval_required</code> event, send the
          approval decision:
        </p>
        <CodeBlock
          language="bash"
          code={`curl -X POST http://localhost:8080/api/v1/missions/{missionId}/approve \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"approvalId": "appr_a1b2c3d4", "decision": "approve", "reason": "Looks safe"}'`}
        />
        <p className="text-xs text-muted font-mono">
          The response is an SSE stream of the continued mission execution.
        </p>
      </section>

      {/* Dynamic endpoints */}
      {missionEndpoints && (
        <section className="space-y-4">
          <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
            Mission Endpoints
          </h2>
          {missionEndpoints.map((ep) => (
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
  );
}
