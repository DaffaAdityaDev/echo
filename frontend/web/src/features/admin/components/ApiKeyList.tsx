"use client";

import React from "react";
import { ApiKey } from "../types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Calendar, Shield, Trash2, Key } from "lucide-react";

interface ApiKeyListProps {
  keys: ApiKey[];
  onRevoke: (id: string) => Promise<void>;
  isRevoking: boolean;
}

export function ApiKeyList({ keys, onRevoke, isRevoking }: ApiKeyListProps) {
  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-zinc-800/80 bg-zinc-900/20 rounded-xl text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-500 mb-4">
          <Key className="h-6 w-6" />
        </div>
        <h4 className="text-zinc-200 font-medium mb-1">No API keys found</h4>
        <p className="text-xs text-zinc-500 max-w-xs">
          Create an API key to allow your applications to communicate with the Echo orchestration engine.
        </p>
      </div>
    );
  }

  const handleRevoke = async (id: string) => {
    if (confirm("Are you sure you want to revoke this API key? This action is permanent and immediate.")) {
      try {
        await onRevoke(id);
      } catch (err) {
        console.error("Failed to revoke key:", err);
      }
    }
  };

  return (
    <div className="overflow-x-auto border border-zinc-800/80 bg-zinc-900/20 rounded-xl glass">
      <table className="w-full text-left border-collapse">
        <thead className="bg-zinc-900/50 border-b border-zinc-800">
          <tr>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Name</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Secret Prefix</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Scopes</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Status</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Created At</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {keys.map((key) => (
            <tr key={key.id} className="hover:bg-white/[0.01] transition-colors">
              <td className="px-6 py-4">
                <div className="font-semibold text-zinc-100 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500/80" />
                  {key.name}
                </div>
              </td>
              <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                {key.prefix}••••••••••••••••
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1.5">
                  {key.scopes.map((scope) => (
                    <Badge key={scope} variant="outline" className="text-[10px] py-0.5">
                      {scope}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="px-6 py-4">
                <Badge variant={key.status === "active" ? "success" : "danger"}>
                  {key.status === "active" ? "Active" : "Revoked"}
                </Badge>
              </td>
              <td className="px-6 py-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  {new Date(key.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </td>
              <td className="px-6 py-4 text-right">
                {key.status === "active" ? (
                  <Button
                    onClick={() => handleRevoke(key.id)}
                    variant="danger"
                    size="sm"
                    className="h-8 w-8 p-0 flex items-center justify-center ml-auto"
                    title="Revoke key"
                    disabled={isRevoking}
                  >
                    <Trash2 size={14} />
                  </Button>
                ) : (
                  <span className="text-xs text-zinc-600 italic">Revoked</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
