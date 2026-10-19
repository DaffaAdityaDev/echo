"use client";

import { Bot, Check, Cloud, Cpu, Image, Search, Sparkles } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { cn } from "@/utils/cn";
import { useModels } from "../hooks/useModels";
import { usePersistAgentConfig } from "../hooks/usePersistAgentConfig";
import { resolveDefaultModel } from "../model-match";
import type { Model } from "../types";

export interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getProviderIcon(provider: string): React.ComponentType<{ className?: string }> | null {
  switch (provider) {
    case "OpenAI":
      return Bot;
    case "Anthropic":
      return Sparkles;
    case "LM Studio":
      return Cpu;
    case "OpenCode Go":
      return Cloud;
    default:
      return null;
  }
}

export function ModelSelectorModal({ isOpen, onClose }: ModelSelectorModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("All");

  const { models } = useModels();
  const defaultModel = useSettingsStore((s) => s.config.defaultModel);

  const persistDefaultModel = usePersistAgentConfig();
  const defaultModelModel = resolveDefaultModel(models, defaultModel);

  if (!isOpen) return null;

  // Extract unique providers
  const providers = ["All", ...Array.from(new Set(models.map((m) => m.provider_name)))];

  // Filter models by search term and selected provider filter pill
  const filteredModels = models.filter((m) => {
    const matchesProvider = selectedProvider === "All" || m.provider_name === selectedProvider;

    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.provider_name.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesProvider && matchesSearch;
  });

  // Helper to derive model metadata tags
  const getModelTags = (m: Model) => {
    const tags: Array<{ label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = [];

    if (m.supports_multimodal) {
      tags.push({
        label: "Multimodal",
        icon: Image,
        color: "bg-accent-soft text-accent border-accent/20",
      });
    }

    return tags;
  };

  const isDefaultModel = (m: Model) => defaultModelModel?.id === m.id;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Intelligence Model"
      description="Choose cloud or local models for session queries and agent loops."
      className="max-w-2xl max-h-[85vh] select-none"
      bodyClassName="flex-1 flex flex-col overflow-hidden"
    >
      <div className="relative flex items-center shrink-0">
        <Search className="h-4 w-4 absolute left-3 text-subtle pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search models by name, provider, or ID (e.g. gpt-4o, claude)..."
          aria-label="Search models"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-surface border border-border rounded-sm pl-9 pr-4 py-2.5 text-xs text-foreground placeholder:text-subtle focus:outline-none focus-visible:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
        />
      </div>

      <div
        role="group"
        aria-label="Filter by provider"
        className="flex items-center gap-2 pt-3 pb-2 overflow-x-auto scrollbar-hide shrink-0"
      >
        {providers.map((p) => {
          const active = selectedProvider === p;
          const Icon = getProviderIcon(p);

          return (
            <button
              key={p}
              type="button"
              onClick={() => setSelectedProvider(p)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-surface border-border text-muted hover:text-foreground hover:bg-surface-hover",
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
              <span>{p}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-2.5 min-h-0">
        {filteredModels.length === 0 ? (
          <p className="text-center py-10 text-xs text-muted">No models match your search query.</p>
        ) : (
          filteredModels.map((m) => {
            const isSelected = isDefaultModel(m);
            const ProviderIcon = getProviderIcon(m.provider_name) || Cpu;
            const tags = getModelTags(m);

            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  void persistDefaultModel({ defaultModel: m.id });
                  onClose();
                }}
                className={cn(
                  "p-3 sm:p-4 rounded-md border transition-all cursor-pointer flex flex-col gap-2 relative group text-left w-full",
                  isSelected
                    ? "bg-accent-soft border-accent/40 shadow-sm"
                    : "bg-surface border-border hover:border-accent/30 hover:bg-surface-hover",
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "p-2 rounded-sm border shrink-0 inline-flex items-center justify-center",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-surface-hover border-border text-foreground",
                      )}
                    >
                      <ProviderIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold tracking-tight text-foreground truncate">{m.name}</span>
                      <span className="block text-2xs text-muted font-mono truncate">{m.id}</span>
                    </span>
                  </span>

                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-1 rounded-sm border border-success/20 shrink-0">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Active</span>
                    </span>
                  )}
                </span>

                <span className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-2xs font-bold text-muted uppercase tracking-wider mr-1">{m.provider_name}</span>
                  {tags.map((tag) => {
                    const TagIcon = tag.icon;

                    return (
                      <span
                        key={tag.label}
                        className={cn(
                          "inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-sm border",
                          tag.color,
                        )}
                      >
                        <TagIcon className="h-3 w-3" aria-hidden="true" />
                        <span>{tag.label}</span>
                      </span>
                    );
                  })}
                </span>
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
}
