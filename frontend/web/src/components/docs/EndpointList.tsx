"use client";

import React from "react";
import type { SchemaObject, TagGroup } from "@/lib/docs/types";
import { EndpointDetail } from "./EndpointDetail";

interface EndpointListProps {
  tagGroups: TagGroup[];
  baseUrl?: string;
  definitions?: Record<string, SchemaObject>;
}

export function EndpointList({ tagGroups, baseUrl, definitions }: EndpointListProps) {
  return (
    <div className="space-y-16 font-mono">
      {tagGroups.map((group) => (
        <section key={group.name} id={`tag-${group.name}`} className="space-y-6 scroll-mt-24">
          <div className="border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg md:text-xl font-bold font-mono text-foreground uppercase tracking-tight">
                {group.name}
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-xs font-mono">
                {group.endpoints.length} {group.endpoints.length === 1 ? "endpoint" : "endpoints"}
              </span>
            </div>
          </div>
          <div className="space-y-6">
            {group.endpoints.map((ep) => (
              <EndpointDetail
                key={`${ep.method}-${ep.path}`}
                endpoint={ep}
                baseUrl={baseUrl}
                definitions={definitions}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
