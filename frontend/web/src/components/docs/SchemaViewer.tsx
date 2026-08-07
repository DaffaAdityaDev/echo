"use client";

import React from "react";
import type { SchemaObject } from "@/lib/docs/types";

function flattenProperties(
  schema: SchemaObject | null,
  definitions?: Record<string, SchemaObject>,
): { name: string; type: string; required: boolean; description: string; example?: unknown; nested?: SchemaObject }[] {
  if (!schema?.properties) return [];

  const requiredFields = new Set<string>(schema.required || []);

  return Object.entries(schema.properties).map(([name, raw]) => {
    const prop = raw as SchemaObject;

    let typeStr = prop.type || "object";
    let nested: SchemaObject | undefined;

    if (prop.$ref) {
      const refName = prop.$ref.replace("#/definitions/", "").replace("#/components/schemas/", "");
      const resolved = definitions?.[refName];
      if (resolved) {
        nested = resolved;
        typeStr = resolved.type || "object";
      } else {
        typeStr = refName;
      }
    }

    if (prop.enum) {
      typeStr = `enum (${prop.enum.join(", ")})`;
    }

    if (prop.items) {
      const items = prop.items as SchemaObject;
      if (items.$ref) {
        const refName = items.$ref.replace("#/definitions/", "").replace("#/components/schemas/", "");
        typeStr = `array<${refName}>`;
      } else {
        typeStr = `array<${items.type || "object"}>`;
      }
    }

    if (prop.type === "object" && prop.properties) {
      nested = prop;
    }

    if (prop.additionalProperties) {
      typeStr = `map<string, ${typeof prop.additionalProperties === "object" ? (prop.additionalProperties as SchemaObject).type || "any" : "any"}>`;
    }

    return {
      name,
      type: typeStr,
      required: requiredFields.has(name),
      description: prop.description || "",
      example: prop.example,
      nested,
    };
  });
}

interface SchemaViewerProps {
  schema: SchemaObject | null;
  title?: string;
  definitions?: Record<string, SchemaObject>;
  maxDepth?: number;
}

export function SchemaViewer({ schema, title, definitions, maxDepth = 2 }: SchemaViewerProps) {
  if (!schema) return null;

  const fields = flattenProperties(schema, definitions);
  if (fields.length === 0) return null;

  return <SchemaTable fields={fields} title={title} definitions={definitions} depth={0} maxDepth={maxDepth} />;
}

function SchemaTable({
  fields,
  title,
  definitions,
  depth,
  maxDepth,
}: {
  fields: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    example?: unknown;
    nested?: SchemaObject;
  }[];
  title?: string;
  definitions?: Record<string, SchemaObject>;
  depth: number;
  maxDepth: number;
}) {
  return (
    <div className="my-4 border border-border bg-white rounded-xs overflow-hidden font-mono shadow-xs">
      {title && (
        <div className="px-4 py-2 bg-slate-50 border-b border-border">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted font-mono">{title}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-mono">
          <thead className="bg-slate-50/80 border-b border-border">
            <tr>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">Field</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">Type</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">Required</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {fields.map((field) => (
              <React.Fragment key={field.name}>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-blue-600 font-semibold">{field.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-purple-600">{field.type}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {field.required ? (
                      <span className="text-rose-600 font-semibold bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-xs text-[10px]">
                        Required
                      </span>
                    ) : (
                      <span className="text-muted font-semibold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-xs text-[10px]">
                        Optional
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted leading-relaxed">
                    {field.description}
                    {field.example !== undefined && (
                      <span className="block text-slate-500 mt-0.5 font-mono text-[10px]">
                        Example: {JSON.stringify(field.example)}
                      </span>
                    )}
                  </td>
                </tr>
                {field.nested && depth < maxDepth && (
                  <tr>
                    <td colSpan={4} className="px-4 pb-2">
                      <div className="ml-4 border-l-2 border-border pl-4">
                        <SchemaViewer schema={field.nested} definitions={definitions} maxDepth={maxDepth} />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
