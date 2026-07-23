"use client";

import React, { useState } from "react";
import {
  Search,
  Check,
  Cpu,
  Bot,
  Sparkles,
  Cloud,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/utils/cn";
import { useModels } from "../hooks/useModels";
import { useChatStore } from "../stores/chatStore";
import type { Model } from "@/lib/queries";

export interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const providerIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  OpenAI: Bot,
  Anthropic: Sparkles,
  "LM Studio": Cpu,
  "OpenCode Go": Cloud,
};

export function ModelSelectorModal({ isOpen, onClose }: ModelSelectorModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("All");

  const { models } = useModels();
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);

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
  const getModelTags = (_m: Model) => [] as Array<{ label: string; icon: React.ComponentType<{ className?: string }>; color: string }>;

  const getContextWindow = (_m: Model) => "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog Body */}
      <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 p-6 md:p-8 text-zinc-900 dark:text-zinc-100 shadow-2xl backdrop-blur-2xl transition-all duration-300 max-h-[85vh] flex flex-col select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200/80 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-display tracking-tight">
                Select Intelligence Model
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Choose cloud or local models for session queries and agent loops.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="pt-4 shrink-0">
          <div className="relative flex items-center">
            <Search className="h-4 w-4 absolute left-3.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search models by name, provider, or ID (e.g. gpt-4o, claude)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-purple-500/40 transition-colors"
            />
          </div>
        </div>

        {/* Provider Filter Pills */}
        <div className="flex items-center gap-2 pt-3 pb-2 overflow-x-auto scrollbar-hide shrink-0">
          {providers.map((p) => {
            const active = selectedProvider === p;
            const Icon = providerIcons[p];
            return (
              <button
                key={p}
                onClick={() => setSelectedProvider(p)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border",
                  active
                    ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20"
                    : "bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span>{p}</span>
              </button>
            );
          })}
        </div>

        {/* Model Cards List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 min-h-0">
          {filteredModels.length === 0 ? (
            <div className="text-center py-10 text-xs text-zinc-400">
              No models match your search query.
            </div>
          ) : (
            filteredModels.map((m) => {
              const isSelected = selectedModel === m.id;
              const ProviderIcon = providerIcons[m.provider_name] || Cpu;
              const tags = getModelTags(m);
              const contextInfo = getContextWindow(m);

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    setSelectedModel(m.id);
                    onClose();
                  }}
                  className={cn(
                    "p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 relative group",
                    isSelected
                      ? "bg-purple-500/10 border-purple-500/40 text-purple-600 dark:text-purple-400 shadow-md"
                      : "bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200/80 dark:border-zinc-800/80 text-zinc-800 dark:text-zinc-200 hover:border-purple-500/30 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "p-2 rounded-xl border shrink-0",
                          isSelected
                            ? "bg-purple-600 text-white border-purple-500"
                            : "bg-zinc-200/80 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                        )}
                      >
                        <ProviderIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                          {m.name}
                        </h4>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                          {m.id}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full border border-zinc-300/40 dark:border-zinc-700/40">
                        {contextInfo}
                      </span>
                      {isSelected && (
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                          <Check className="h-3.5 w-3.5" />
                          <span>Active</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Capability Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mr-1">
                      {m.provider_name}
                    </span>
                    {tags.map((tag, idx) => {
                      const TagIcon = tag.icon;
                      return (
                        <span
                          key={idx}
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border",
                            tag.color
                          )}
                        >
                          <TagIcon className="h-3 w-3" />
                          <span>{tag.label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
