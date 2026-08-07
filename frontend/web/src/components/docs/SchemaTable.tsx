"use client";

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
    <div className="overflow-x-auto my-4 border border-border bg-white rounded-xs font-mono shadow-xs animate-in">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-border">
          <tr>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted">Field</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted">Type</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted">Required</th>
            <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {fields.map((field) => (
            <tr key={field.name} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-blue-600 font-semibold">{field.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-purple-600">{field.type}</td>
              <td className="px-4 py-3 text-xs">
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
              <td className="px-4 py-3 text-xs text-muted leading-relaxed">{field.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
