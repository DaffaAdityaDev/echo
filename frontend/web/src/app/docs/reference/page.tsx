"use client";

import React from "react";
import { EndpointList } from "@/components/docs/EndpointList";
import { useSpec } from "@/components/docs/OpenApiSpecProvider";

export default function ReferencePage() {
  const { spec, loading, error } = useSpec();

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl font-mono">
        <div className="h-8 bg-slate-200 rounded-xs w-48 animate-pulse" />
        <div className="h-4 bg-slate-200 rounded-xs w-96 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-slate-100 border border-border rounded-xs animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl font-mono">
        <div className="p-5 border border-rose-200 bg-rose-50 rounded-xs">
          <p className="text-xs font-bold text-rose-700">Failed to load API specification: {error}</p>
          <p className="text-xs text-muted mt-2">
            Make sure the backend spec file exists at{" "}
            <code className="text-foreground font-semibold">backend/api/docs/swagger.json</code>
          </p>
        </div>
      </div>
    );
  }

  if (!spec) return null;

  const baseUrl = spec.info.host
    ? `http://${spec.info.host}${spec.info.basePath || ""}api/v1`
    : "http://localhost:8080/api/v1";

  return (
    <div className="space-y-8 max-w-4xl font-mono">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">API Reference</h1>
        <div className="flex items-center gap-3 mt-1 text-xs">
          <p className="text-muted">
            {spec.info.title} — v{spec.info.version}
          </p>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-blue-600 font-bold">
            {spec.tags.reduce((s, t) => s + t.endpoints.length, 0)} endpoints
          </span>
        </div>
        {spec.info.description && (
          <p className="text-xs text-muted mt-3 leading-relaxed max-w-3xl font-mono">{spec.info.description}</p>
        )}
      </div>

      <EndpointList tagGroups={spec.tags} baseUrl={baseUrl} definitions={spec.definitions} />
    </div>
  );
}
