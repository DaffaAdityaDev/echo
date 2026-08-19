"use client";

import { useSpec } from "@/components/docs/OpenApiSpecProvider";

export default function TroubleshootingPage() {
  const { spec } = useSpec();
  const _healthEndpoint = spec?.tags.flatMap((t) => t.endpoints).find((ep) => ep.path === "/health");

  return (
    <div className="space-y-12 max-w-4xl font-mono">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">Troubleshooting</h1>
        <p className="text-xs text-muted mt-2 leading-relaxed font-mono">
          Common issues, error codes, and debugging tips for the Echo API.
        </p>
      </div>

      {/* Error Codes Table */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          HTTP Status Codes
        </h2>
        <p className="text-xs text-muted leading-relaxed font-mono">
          The Echo API uses standard HTTP response codes to indicate success or failure.
        </p>
        <div className="overflow-x-auto border border-border bg-white rounded-xs shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted">Code</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted">Common Triggers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              <tr className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold text-emerald-600">200</td>
                <td className="px-4 py-3 font-bold text-foreground">OK / Stream Start</td>
                <td className="px-4 py-3 text-muted">Success JSON payload or SSE stream starting.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold text-emerald-600">201</td>
                <td className="px-4 py-3 font-bold text-foreground">Created</td>
                <td className="px-4 py-3 text-muted">Resource successfully created (session, API key).</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold text-amber-600">400</td>
                <td className="px-4 py-3 font-bold text-foreground">Bad Request</td>
                <td className="px-4 py-3 text-muted">Invalid payload format, validation failure, unknown model IDs.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold text-rose-600">401</td>
                <td className="px-4 py-3 font-bold text-foreground">Unauthorized</td>
                <td className="px-4 py-3 text-muted">Missing or invalid Authorization header token.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold text-rose-600">403</td>
                <td className="px-4 py-3 font-bold text-foreground">Forbidden</td>
                <td className="px-4 py-3 text-muted">Invalid internal token credentials or tier limits.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold text-slate-600">404</td>
                <td className="px-4 py-3 font-bold text-foreground">Not Found</td>
                <td className="px-4 py-3 text-muted">Endpoint route or entity does not exist.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold text-slate-600">404 (HITL)</td>
                <td className="px-4 py-3 font-bold text-foreground">Approval Expired</td>
                <td className="px-4 py-3 text-muted">The HITL approval request has timed out.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold text-rose-600">500</td>
                <td className="px-4 py-3 font-bold text-foreground">Internal Server Error</td>
                <td className="px-4 py-3 text-muted">Gateway error, agent unreachable, database issues.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold text-slate-600">501</td>
                <td className="px-4 py-3 font-bold text-foreground">Not Implemented</td>
                <td className="px-4 py-3 text-muted">Feature is pending implementation.</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold text-rose-600">502</td>
                <td className="px-4 py-3 font-bold text-foreground">Bad Gateway</td>
                <td className="px-4 py-3 text-muted">Agent unreachable during HITL decision proxy.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Common Issues */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-foreground border-b border-border pb-2 uppercase tracking-tight">
          Common Issues
        </h2>
        <div className="space-y-4">
          <div className="p-4 border border-border bg-white rounded-xs shadow-xs crosshair-container">
            <h3 className="text-xs font-bold text-foreground mb-1 uppercase tracking-tight">401 Unauthorized</h3>
            <p className="text-xs text-muted leading-relaxed font-mono">
              Your token may have expired. Re-authenticate via the login endpoint.
            </p>
          </div>
          <div className="p-4 border border-border bg-white rounded-xs shadow-xs crosshair-container">
            <h3 className="text-xs font-bold text-foreground mb-1 uppercase tracking-tight">SSE Stream Empty</h3>
            <p className="text-xs text-muted leading-relaxed font-mono">
              Ensure you are streaming the response body correctly. The stream uses{" "}
              <code className="text-blue-600 font-bold">text/event-stream</code> content type with{" "}
              <code className="text-blue-600 font-bold">data:</code> prefixed JSON lines.
            </p>
          </div>
          <div className="p-4 border border-border bg-white rounded-xs shadow-xs crosshair-container">
            <h3 className="text-xs font-bold text-foreground mb-1 uppercase tracking-tight">HITL Approval Not Found</h3>
            <p className="text-xs text-muted leading-relaxed font-mono">
              Approval requests expire after a TTL (default 5 minutes). Create a new request by re-running the protected
              operation.
            </p>
          </div>
          <div className="p-4 border border-border bg-white rounded-xs shadow-xs crosshair-container">
            <h3 className="text-xs font-bold text-foreground mb-1 uppercase tracking-tight">Model Not Found</h3>
            <p className="text-xs text-muted leading-relaxed font-mono">
              Check available models via <code className="text-blue-600 font-bold">GET /models</code>. The model ID must
              match exactly.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
