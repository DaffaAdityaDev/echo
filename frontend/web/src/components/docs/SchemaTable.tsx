"use client";

import React from "react";

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface SchemaTableProps {
  fields: SchemaField[];
}

export function SchemaTable({ fields }: SchemaTableProps) {
  if (!fields || fields.length === 0) return null;

  return (
    <div className="overflow-x-auto my-4 border border-zinc-800 bg-zinc-950/20 rounded-xl glass animate-in">
      <table className="w-full text-left border-collapse">
        <thead className="bg-zinc-900/50 border-b border-zinc-800">
          <tr>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Field</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Type</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Required</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {fields.map((field) => (
            <tr key={field.name} className="hover:bg-white/[0.01] transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-blue-400 font-semibold">{field.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-purple-400">{field.type}</td>
              <td className="px-4 py-3 text-xs">
                {field.required ? (
                  <span className="text-red-500 font-medium bg-red-500/5 border border-red-500/10 px-1.5 py-0.5 rounded text-[10px]">
                    Required
                  </span>
                ) : (
                  <span className="text-zinc-500 font-medium bg-zinc-800/30 border border-zinc-700/20 px-1.5 py-0.5 rounded text-[10px]">
                    Optional
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-zinc-400 leading-relaxed">{field.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
