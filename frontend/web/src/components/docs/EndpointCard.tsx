"use client";

import React from "react";
import { CodeBlock } from "./CodeBlock";
import { SchemaTable, SchemaField } from "./SchemaTable";

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
    GET: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
    POST: "bg-blue-500/10 text-blue-500 border border-blue-500/20",
    DELETE: "bg-red-500/10 text-red-500 border border-red-500/20",
    PUT: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
  };

  return (
    <div className="border border-zinc-800/80 bg-zinc-900/10 rounded-xl p-5 md:p-6 space-y-6 glass hover:border-zinc-800 transition-all duration-300 animate-in">
      {/* Route Badge & Path */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={`px-2.5 py-1 text-xs font-bold uppercase rounded-md tracking-wider ${methodVariants[method]}`}>
          {method}
        </div>
        <span className="font-mono text-sm font-bold text-zinc-100 select-all tracking-tight break-all">
          {path}
        </span>
      </div>

      <p className="text-sm text-zinc-400 leading-relaxed max-w-3xl">
        {description}
      </p>

      {/* Request Params */}
      {requestFields.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Request Parameters</h5>
          <SchemaTable fields={requestFields} />
        </div>
      )}

      {/* Response Params */}
      {responseFields.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Response Fields</h5>
          <SchemaTable fields={responseFields} />
        </div>
      )}

      {/* Curl Command Example */}
      {curlExample && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">cURL Example</h5>
          <CodeBlock language="bash" code={curlExample} />
        </div>
      )}
    </div>
  );
}
