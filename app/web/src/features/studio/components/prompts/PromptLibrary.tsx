"use client";

import { AlertCircle, ChevronRight, Plus, RefreshCcw, ScrollText, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import type { PromptTemplate } from "../../types";
import { EmptyState } from "../shared/EmptyState";

export interface PromptLibraryProps {
  templates: PromptTemplate[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, description: string) => Promise<boolean>;
  isCreating: boolean;
}

export function PromptLibrary({
  templates,
  isLoading,
  error,
  onRetry,
  selectedId,
  onSelect,
  onCreate,
  isCreating,
}: PromptLibraryProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [search, setSearch] = useState("");

  const filtered = templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!name.trim()) return;
    const created = await onCreate(name.trim(), desc.trim());

    if (!created) return;
    setName("");
    setDesc("");
    setShowCreate(false);
  };

  if (error) {
    return (
      <div
        role="alert"
        className="p-6 border border-danger/30 bg-danger/5 rounded-md text-center space-y-3 flex flex-col items-center"
      >
        <AlertCircle className="h-5 w-5 text-danger" aria-hidden="true" />
        <p className="text-xs text-danger">Failed to load prompt templates: {error.message}</p>
        <Button size="sm" variant="secondary" onClick={onRetry} className="gap-1.5 text-xs">
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search templates"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full h-9 pl-9 pr-3 rounded-md bg-surface-hover border border-border text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreate(!showCreate)}
          aria-expanded={showCreate}
          className="gap-1.5 text-xs font-semibold shrink-0 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> New Template
        </Button>
      </div>

      {showCreate && (
        <div className="border border-border bg-surface rounded-md p-4 space-y-3">
          <input
            aria-label="Template name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name (e.g. customer_support_agent)"
            className="w-full h-9 px-3 rounded-md bg-elevated border border-border text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/50"
          />
          <input
            aria-label="Template description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full h-9 px-3 rounded-md bg-elevated border border-border text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/50"
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
        <div className="space-y-2" role="status" aria-label="Loading templates">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-surface-hover rounded-md animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? "No templates match your search" : "No prompt templates yet"}
          description="Create your first prompt template to start versioning and testing."
          action={
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" /> Create Template
            </Button>
          }
        />
      ) : (
        <div className="border border-border bg-elevated rounded-md overflow-hidden divide-y divide-border">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              aria-current={selectedId === t.id ? "true" : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover transition-colors text-left cursor-pointer",
                selectedId === t.id && "bg-accent-soft",
              )}
            >
              <div className="p-2 rounded-md bg-accent/10 text-accent border border-accent/20 shrink-0">
                <ScrollText className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-foreground truncate">{t.name}</div>
                <div className="text-xs text-muted truncate">{t.description || "No description"}</div>
              </div>
              <div className="text-xs text-muted shrink-0 font-mono font-medium">v{t.active_version}</div>
              <ChevronRight className="h-4 w-4 text-muted shrink-0" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
