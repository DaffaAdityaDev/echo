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
      <div className="p-4 rounded-md border border-accent/30 bg-accent-soft space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Resolved System Prompt Metadata
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase bg-accent/15 text-accent border border-accent/30 shrink-0">
            {executionModeLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <StatCard label="Execution Mode" value={executionModeLabel} tone="success" />
          <StatCard
            label="Custom Prompt State"
            value={hasCustomBehavior ? "Promoted DB Version" : "Default NLAH Base"}
            tone="accent"
          />
          <StatCard label="Captured Turns" value={`${debugPacketHistory.length} turns`} tone="default" />
        </div>
      </div>

      {debugPacketHistory.length > 1 && (
        <div role="group" aria-labelledby="debug-turn-label" className="flex items-center gap-2 overflow-x-auto pb-1">
          <span id="debug-turn-label" className="text-2xs font-bold uppercase text-muted shrink-0">
            Select Turn:
          </span>
          {debugPacketHistory.map((d, i) => (
            <button
              key={`${d.missionId ?? "debug"}-${d.timestamp}`}
              type="button"
              onClick={() => setSelectedDebugIdx(i)}
              aria-pressed={i === effectiveDebugIdx}
              className={cn(
                "px-3 py-1 rounded-sm text-xs font-semibold border cursor-pointer whitespace-nowrap transition-all",
                i === effectiveDebugIdx
                  ? "bg-accent/15 text-accent border-accent/40"
                  : "bg-surface-hover text-muted border-border hover:text-foreground hover:bg-border",
              )}
            >
              Turn {i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" aria-hidden="true" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Raw Assembled System Prompt & Schemas
            </h3>
          </div>

          {activeDebugInfo?.systemPrompt && (
            <CopyButton
              text={activeDebugInfo.systemPrompt}
              label="Copy Prompt"
              className="px-2.5 py-1 rounded-sm text-xs bg-surface-hover hover:bg-border text-foreground border border-border shrink-0"
            />
          )}
        </div>

        {activeDebugInfo?.systemPrompt && (
          <div className="relative">
            <Search
              className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search system prompt"
              placeholder="Search inside system prompt text (e.g. CORE PROTOCOLS, NYA-CAT)..."
              value={promptSearch}
              onChange={(e) => setPromptSearch(e.target.value)}
              className="w-full bg-surface-hover border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/50"
            />
          </div>
        )}

        {activeDebugInfo?.systemPrompt ? (
          <div className="relative rounded-md border border-code-border bg-code overflow-hidden">
            {filteredPromptLines !== null && filteredPromptLines.length === 0 ? (
              <div role="status" className="p-4 text-xs text-code-muted italic text-center">
                No lines match &quot;{promptSearch.trim()}&quot;.
              </div>
            ) : (
              <pre className="p-4 text-code-foreground text-xs font-mono whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed select-text">
                {filteredPromptLines ? filteredPromptLines.join("\n") : systemPromptText}
              </pre>
            )}
          </div>
        ) : (
          <div className="p-8 rounded-md border border-border bg-surface text-xs text-muted italic text-center space-y-2">
            <FileText className="h-6 w-6 mx-auto text-muted" aria-hidden="true" />
            <p>No system prompt telemetry captured yet. Send an agent query to record backend debug packets.</p>
          </div>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Raw Message History Payload ({activeDebugInfo?.historyLength || 0} items)
          </h3>
          {activeDebugInfo?.rawMessages && (
            <CopyButton
              text={JSON.stringify(activeDebugInfo.rawMessages, null, 2)}
              label="Copy History Payload"
              className="px-2.5 py-1 rounded-sm text-xs bg-surface-hover hover:bg-border text-foreground border border-border shrink-0"
            />
          )}
        </div>
        {activeDebugInfo?.rawMessages ? (
          <pre className="p-4 bg-code text-code-foreground rounded-md border border-code-border text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed select-text">
            {JSON.stringify(activeDebugInfo.rawMessages, null, 2)}
          </pre>
        ) : (
          <div className="p-6 rounded-md border border-border bg-surface text-xs text-muted italic text-center">
            No message history payload captured yet.
          </div>
        )}
      </div>
    </div>
  );
}
