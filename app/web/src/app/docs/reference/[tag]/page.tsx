"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EndpointList } from "@/features/docs/components/EndpointList";
import { useSpec } from "@/features/docs/components/OpenApiSpecProvider";

export default function TagReferencePage() {
  const params = useParams();
  // SAFETY: Next.js route parameter matches [tag] dynamic slug segment
  const rawTag = (params?.tag as string) || "";
  const { spec, loading, error } = useSpec();

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl font-mono">
        <div className="h-8 bg-border rounded-xs w-48 animate-pulse" />
        <div className="h-4 bg-border rounded-xs w-full max-w-96 animate-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="h-32 bg-surface-hover border border-border rounded-xs animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl font-mono">
        <div className="p-5 border border-danger/30 bg-danger/10 rounded-xs">
          <p className="text-xs font-bold text-danger">Failed to load API specification: {error}</p>
        </div>
      </div>
    );
  }

  if (!spec) return null;

  // Find matching tag group case-insensitively
  const tagGroup = spec.tags.find((t) => t.name.toLowerCase() === rawTag.toLowerCase());

  const baseUrl = spec.info.host
    ? `http://${spec.info.host}${spec.info.basePath || ""}api/v1`
    : "http://localhost:8080/api/v1";

  if (!tagGroup) {
    return (
      <div className="space-y-6 max-w-4xl font-mono">
        <div>
          <Link
            href="/docs/reference"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft size={14} aria-hidden="true" /> Back to All Endpoints
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase">Tag "{rawTag}" Not Found</h1>
          <p className="text-xs text-muted mt-2">Available tag groups: {spec.tags.map((t) => t.name).join(", ")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl font-mono">
      <div>
        <Link
          href="/docs/reference"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-accent transition-colors mb-4"
        >
          <ArrowLeft size={14} aria-hidden="true" /> All API Reference Endpoints
        </Link>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-xs bg-accent-soft border border-accent/30 text-accent text-2xs font-bold uppercase tracking-wider">
            API Category
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground uppercase mt-2">{tagGroup.name} Reference</h1>
        <div className="flex items-center gap-3 mt-1 text-xs">
          <p className="text-muted">
            {spec.info.title} — v{spec.info.version}
          </p>
          <span className="text-subtle">|</span>
          <span className="text-xs text-accent font-bold">
            {tagGroup.endpoints.length} {tagGroup.endpoints.length === 1 ? "endpoint" : "endpoints"}
          </span>
        </div>
      </div>

      <EndpointList tagGroups={[tagGroup]} baseUrl={baseUrl} definitions={spec.definitions} />
    </div>
  );
}
