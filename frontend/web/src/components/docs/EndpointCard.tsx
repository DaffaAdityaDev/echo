"use client";

import React from "react";
import { CodeBlock } from "./CodeBlock";
import { type SchemaField, SchemaTable } from "./SchemaTable";

interface EndpointCardProps {
  method: "GET" | "POST" | "DELETE" | "PUT";
  path: string;
  description: string;
  requestFields?: SchemaField[];
  responseFields?: SchemaField[];
  curlExample?: string;
}

export function EndpointCard({
  method,
  path,
  description,
  requestFields = [],
  responseFields = [],
  curlExample,
}: EndpointCardProps) {
  const methodVariants = {
    GET: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30",
    POST: "bg-blue-500/10 text-blue-500 border border-blue-500/30",
    DELETE: "bg-rose-500/10 text-rose-500 border border-rose-500/30",
    PUT: "bg-amber-500/10 text-amber-500 border border-amber-500/30",
  };

  return (
    <div className="border border-border bg-white rounded-xs p-5 md:p-6 space-y-6 shadow-xs font-mono crosshair-container relative animate-in">
      {/* Route Badge & Path */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded-xs tracking-wider ${methodVariants[method]}`}
        >
          {method}
        </div>
        <span className="font-mono text-sm font-bold text-foreground select-all tracking-tight break-all">{path}</span>
      </div>

      <p className="text-xs text-muted leading-relaxed max-w-3xl font-mono">{description}</p>

      {/* Request Params */}
      {requestFields.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-foreground">Request Parameters</h5>
          <SchemaTable fields={requestFields} />
        </div>
      )}

      {/* Response Params */}
      {responseFields.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-foreground">Response Fields</h5>
          <SchemaTable fields={responseFields} />
        </div>
      )}

      {/* Curl Command Example */}
      {curlExample && (
        <div className="space-y-2">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-foreground">cURL Example</h5>
          <CodeBlock language="bash" code={curlExample} />
        </div>
      )}
    </div>
  );
}
