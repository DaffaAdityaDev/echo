"use client";

import { AlertCircle, ChevronRight, Plus, ScrollText, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { PromptTemplate } from "../../types";
import { EmptyState } from "../shared/EmptyState";

export interface PromptLibraryProps {
  templates: PromptTemplate[];
  isLoading: boolean;
  error: Error | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, description: string) => Promise<void>;
  isCreating: boolean;
}

export function PromptLibrary({ templates, isLoading, error, onSelect, onCreate, isCreating }: PromptLibraryProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [search, setSearch] = useState("");

  const filtered = templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!name.trim()) return;
    await onCreate(name.trim(), desc.trim());
    setName("");
    setDesc("");
    setShowCreate(false);
  };

  if (error) {
    return (
      <div className="p-6 border border-red-500/20 bg-red-500/5 rounded-2xl text-center text-red-400 text-sm">
        <AlertCircle className="h-5 w-5 mx-auto mb-2" />
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
          className="gap-1.5 text-xs font-semibold shrink-0 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> New Template
        </Button>
      </div>

      {showCreate && (
        <div className="border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl p-4 space-y-3 backdrop-blur-sm">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name (e.g. customer_support_agent)"
            className="w-full h-9 px-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500/50"
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full h-9 px-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-blue-500/50"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} isLoading={isCreating} disabled={!name.trim()}>
              Create
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-zinc-100 dark:bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? "No templates match your search" : "No prompt templates yet"}
          description="Create your first prompt template to start versioning and testing."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Create Template
            </Button>
          }
        />
      ) : (
        <div className="border border-zinc-200/80 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/40 rounded-2xl overflow-hidden divide-y divide-zinc-200/80 dark:divide-zinc-800">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 transition-colors text-left cursor-pointer"
            >
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                <ScrollText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{t.name}</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {t.description || "No description"}
                </div>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0 font-mono font-medium">
                v{t.active_version}
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
