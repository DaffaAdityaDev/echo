"use client";

import { generateExample, SSE_SAMPLE } from "@/features/docs/lib/example";
import type { Endpoint, SchemaObject } from "@/features/docs/lib/types";
import { CodeBlock } from "@/components/CodeBlock";
import { SchemaTable, SchemaViewer } from "./SchemaViewer";

interface EndpointDetailProps {
  endpoint: Endpoint;
  baseUrl?: string;
  definitions?: Record<string, SchemaObject>;
}

function getMethodStyle(method: string): string {
  switch (method.toLowerCase()) {
    case "get":
      return "bg-success/10 text-success border border-success/30";
    case "post":
      return "bg-accent/10 text-accent border border-accent/30";
    case "put":
      return "bg-warning/10 text-warning border border-warning/30";
    case "delete":
      return "bg-danger/10 text-danger border border-danger/30";
    case "patch":
      return "bg-accent/10 text-accent border border-accent/30";
    default:
      return "bg-subtle/10 text-muted border border-border-strong";
  }
}

function generateCurl(endpoint: Endpoint, baseUrl?: string): string {
  const method = endpoint.method.toUpperCase();
  const rawBase = (baseUrl || "http://localhost:8080/api/v1").replace(/\/+$/, "");

  let cleanPath = endpoint.path.replace(/\{(\w+)\}/g, "<$1>");

  if (!cleanPath.startsWith("/")) {
    cleanPath = `/${cleanPath}`;
  }

  // Deduplicate base path prefix e.g. rawBase "http://localhost:8080/api/v1" and cleanPath "/api/v1/sessions/<id>"
  try {
    const urlObj = new URL(rawBase);
    const basePrefix = urlObj.pathname.replace(/\/+$/, "");

    if (basePrefix && basePrefix !== "/" && cleanPath.startsWith(basePrefix)) {
      cleanPath = cleanPath.substring(basePrefix.length);
    }
  } catch {
    if (rawBase.endsWith("/api/v1") && cleanPath.startsWith("/api/v1")) {
      cleanPath = cleanPath.substring(7);
    }
  }

  const _pathParams = endpoint.parameters.filter((p) => p.in === "path");
  const queryParams = endpoint.parameters.filter((p) => p.in === "query");
  const headerParams = endpoint.parameters.filter((p) => p.in === "header");
  const hasBody = endpoint.method === "post" || endpoint.method === "put" || endpoint.method === "patch";

  const headers: string[] = [];

  if (hasBody) {
    headers.push('-H "Content-Type: application/json"');
  }

  for (const h of headerParams) {
    headers.push(`-H "${h.name}: <${h.name}>"`);
  }

  if (endpoint.security.length > 0) {
    headers.push('-H "Authorization: Bearer <token>"');
  }

  const queryStr = queryParams.length > 0 ? `?${queryParams.map((p) => `${p.name}=<${p.name}>`).join("&")}` : "";

  const fullUrl = `${rawBase}${cleanPath}${queryStr}`;
  const lines: string[] = [];
  lines.push(`curl -X ${method} "${fullUrl}" \\`);

  for (const h of headers) {
    lines.push(`  ${h} \\`);
  }

  if (hasBody && endpoint.requestBodySchema) {
    const props = endpoint.requestBodySchema.properties
      ? Object.fromEntries(Object.keys(endpoint.requestBodySchema.properties).map((key) => [key, `<${key}>`] as const))
      : { message: "<string>" };

    lines.push(`  -d '${JSON.stringify(props, null, 2).replace(/\n/g, "\n  ")}'`);
  } else {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ \\$/, "");
  }

  return lines.join("\n");
}

export function EndpointDetail({ endpoint, baseUrl, definitions }: EndpointDetailProps) {
  const curl = generateCurl(endpoint, baseUrl);
  const methodColor = getMethodStyle(endpoint.method);

  const pathParams = endpoint.parameters.filter((p) => p.in === "path");
  const queryParams = endpoint.parameters.filter((p) => p.in === "query");
  const isSse = endpoint.produces?.some((p) => p.includes("event-stream")) ?? false;

  return (
    <div className="border border-border bg-elevated rounded-xs p-5 md:p-6 space-y-6 shadow-xs font-mono crosshair-container relative">
      <div className="flex flex-wrap items-center gap-3">
        <div className={`px-2.5 py-1 text-2xs font-bold uppercase rounded-xs tracking-wider ${methodColor}`}>
          {endpoint.method}
        </div>
        <span className="font-mono text-sm font-bold text-foreground select-all tracking-tight break-all">
          {endpoint.path}
        </span>
      </div>

      {endpoint.summary && <p className="text-xs text-muted leading-relaxed max-w-3xl font-mono">{endpoint.summary}</p>}

      {endpoint.description && endpoint.description !== endpoint.summary && (
        <p className="text-xs text-muted/80 leading-relaxed font-mono">{endpoint.description}</p>
      )}

      {pathParams.length > 0 && (
        <SchemaTable
          title="Path Parameters"
          depth={0}
          maxDepth={1}
          fields={pathParams.map((p) => ({
            name: p.name,
            type: p.type || "string",
            required: !!p.required,
            description: p.description || "",
          }))}
        />
      )}

      {queryParams.length > 0 && (
        <SchemaTable
          title="Query Parameters"
          depth={0}
          maxDepth={1}
          fields={queryParams.map((p) => ({
            name: p.name,
            type: p.type || "string",
            required: !!p.required,
            description: p.description || "",
          }))}
        />
      )}

      {endpoint.requestBodySchema && (
        <div className="space-y-2">
          <SchemaViewer schema={endpoint.requestBodySchema} title="Request Body" definitions={definitions} />
          <div className="space-y-1.5">
            <h6 className="text-2xs font-bold uppercase tracking-wider text-muted">Example Request</h6>
            <CodeBlock
              language="json"
              code={JSON.stringify(generateExample(endpoint.requestBodySchema, definitions), null, 2)}
            />
          </div>
        </div>
      )}

      {endpoint.responses.length > 0 && (
        <div className="space-y-4">
          <h5 className="text-2xs font-bold uppercase tracking-wider text-foreground">Responses</h5>
          {endpoint.responses.map((resp) => (
            <ResponseCard
              key={resp.statusCode}
              response={resp}
              definitions={definitions}
              sse={isSse && resp.statusCode.startsWith("2")}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h5 className="text-2xs font-bold uppercase tracking-wider text-foreground">cURL Example</h5>
        <CodeBlock language="bash" code={curl} />
      </div>
    </div>
  );
}

function ResponseCard({
  response,
  definitions,
  sse,
}: {
  response: { statusCode: string; description: string; schema: SchemaObject | null };
  definitions?: Record<string, SchemaObject>;
  sse?: boolean;
}) {
  const statusNum = parseInt(response.statusCode, 10);

  const colorClass =
    statusNum >= 200 && statusNum < 300
      ? "text-success font-bold"
      : statusNum >= 400 && statusNum < 500
        ? "text-warning font-bold"
        : statusNum >= 500
          ? "text-danger font-bold"
          : "text-muted font-bold";

  const hasProperties = !!response.schema?.properties;

  const example = sse
    ? SSE_SAMPLE
    : response.schema && hasProperties
      ? JSON.stringify(generateExample(response.schema, definitions), null, 2)
      : null;

  return (
    <div className="border border-border bg-surface rounded-xs p-4 font-mono">
      <div className="flex items-center gap-3 mb-2">
        <span className={`font-mono text-xs ${colorClass}`}>{response.statusCode}</span>
        <span className="text-xs text-muted">{response.description}</span>
      </div>
      {response.schema && <SchemaViewer schema={response.schema} definitions={definitions} />}
      {example !== null && (
        <div className="mt-3 space-y-1.5">
          <h6 className="text-2xs font-bold uppercase tracking-wider text-muted">
            {sse ? "Example Stream" : "Example Response"}
          </h6>
          <CodeBlock language={sse ? "text" : "json"} code={example} />
        </div>
      )}
    </div>
  );
}
