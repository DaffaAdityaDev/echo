"use client";

import { FileText, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { StatCard } from "@/components/ui/StatCard";
import { cn } from "@/utils/cn";
import { useChatStore } from "../../stores/chatStore";

export function PromptInspectorPanel() {
  const debugPacketHistory = useChatStore((s) => s.debugPacketHistory);

  const [promptSearch, setPromptSearch] = useState<string>("");
  const [selectedDebugIdx, setSelectedDebugIdx] = useState<number>(debugPacketHistory.length - 1);

  const effectiveDebugIdx =
    selectedDebugIdx < 0 || selectedDebugIdx >= debugPacketHistory.length
      ? debugPacketHistory.length - 1
      : selectedDebugIdx;
  const activeDebugInfo = debugPacketHistory[effectiveDebugIdx] || null;

  const systemPromptText = activeDebugInfo?.systemPrompt || "";
  const isDirectMode = systemPromptText.includes("DIRECT MODE");
  const isCoordinatorMode = systemPromptText.includes("COORDINATOR MODE");
  const executionModeLabel = isCoordinatorMode ? "COORDINATOR MODE" : isDirectMode ? "DIRECT MODE" : "STANDARD";
  const hasCustomBehavior =
    systemPromptText.length > 0 && !systemPromptText.includes("RESEARCH WORKFLOW INSTRUCTIONS:");

  const filteredPromptLines = useMemo(() => {
    const needle = promptSearch.trim().toLowerCase();
    if (!needle) return null;
    return systemPromptText.split("\n").filter((line) => line.toLowerCase().includes(needle));
  }, [systemPromptText, promptSearch]);

  return (
    <div className="space-y-4">
      {/* Active Harness Telemetry Overview Card */}
      <div className="p-4 rounded-2xl border border-purple-500/30 dark:border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-zinc-50/80 dark:via-zinc-900/50 to-zinc-100/40 dark:to-zinc-900/30 space-y-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
              Resolved System Prompt Metadata
            </h4>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40">
            {executionModeLabel}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1">
          <StatCard label="Execution Mode" value={executionModeLabel} tone="emerald" />
          <StatCard
            label="Custom Prompt State"
            value={hasCustomBehavior ? "Promoted DB Version" : "Default NLAH Base"}
            tone="purple"
          />
          <StatCard label="Captured Turns" value={`${debugPacketHistory.length} turns`} tone="blue" />
        </div>
      </div>

      {/* Debug turn selector */}
      {debugPacketHistory.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 shrink-0">
            Select Turn:
          </span>
          {debugPacketHistory.map((d, i) => (
            <button
              key={`${d.missionId ?? "debug"}-${d.timestamp}`}
              type="button"
              onClick={() => setSelectedDebugIdx(i)}
              className={cn(
                "px-3 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer whitespace-nowrap transition-all",
                i === effectiveDebugIdx
                  ? "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/50 shadow-sm"
                  : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800",
              )}
            >
              Turn {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* System Prompt Inspector with Search */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-300 uppercase tracking-wider">
              Raw Assembled System Prompt & Schemas
            </h4>
          </div>

          {activeDebugInfo?.systemPrompt && (
            <CopyButton
              text={activeDebugInfo.systemPrompt}
              label="Copy Prompt"
              className="px-2.5 py-1 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800"
            />
          )}
        </div>

        {/* Prompt Search Filter */}
        {activeDebugInfo?.systemPrompt && (
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search inside system prompt text (e.g. CORE PROTOCOLS, NYA-CAT)..."
              value={promptSearch}
              onChange={(e) => setPromptSearch(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>
        )}

        {activeDebugInfo?.systemPrompt ? (
          <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-900 dark:bg-zinc-950 overflow-hidden">
            {filteredPromptLines !== null && filteredPromptLines.length === 0 ? (
              <div className="p-4 text-xs text-zinc-400 italic text-center">
                No lines match &quot;{promptSearch.trim()}&quot;.
              </div>
            ) : (
              <pre className="p-4 text-zinc-100 dark:text-zinc-200 text-[11px] font-mono whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed select-text">
                {filteredPromptLines ? filteredPromptLines.join("\n") : systemPromptText}
              </pre>
            )}
          </div>
        ) : (
          <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 text-xs text-zinc-500 dark:text-zinc-400 italic text-center space-y-2">
            <FileText className="h-6 w-6 mx-auto text-zinc-400 dark:text-zinc-600" />
            <p>No system prompt telemetry captured yet. Send an agent query to record backend debug packets.</p>
          </div>
        )}
      </div>

      {/* Message History Inspector */}
      <div className="space-y-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-300 uppercase tracking-wider">
            Raw Message History Payload ({activeDebugInfo?.historyLength || 0} items)
          </h4>
          {activeDebugInfo?.rawMessages && (
            <CopyButton
              text={JSON.stringify(activeDebugInfo.rawMessages, null, 2)}
              label="Copy History Payload"
              className="px-2.5 py-1 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800"
            />
          )}
        </div>
        {activeDebugInfo?.rawMessages ? (
          <pre className="p-4 bg-zinc-900 dark:bg-zinc-950 text-zinc-100 dark:text-zinc-200 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed select-text">
            {JSON.stringify(activeDebugInfo.rawMessages, null, 2)}
          </pre>
        ) : (
          <div className="p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 text-xs text-zinc-500 dark:text-zinc-400 italic text-center">
            No message history payload captured yet.
          </div>
        )}
      </div>
    </div>
  );
}
