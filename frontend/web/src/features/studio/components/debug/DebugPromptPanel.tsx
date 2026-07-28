"use client";

import { Check, ChevronRight, Code2, Copy, MessagesSquare } from "lucide-react";
import React, { useState } from "react";
import { cn } from "@/utils/cn";

interface DebugInfo {
  iteration: number;
  systemPrompt: string;
  messages: { role: string; content: string }[];
}

interface DebugPromptPanelProps {
  debugInfos: DebugInfo[];
  isRunning: boolean;
  className?: string;
}

const roleStyles: Record<string, string> = {
  user: "bg-blue-50 border-blue-200 text-blue-700",
  assistant: "bg-emerald-50 border-emerald-200 text-emerald-700",
  system: "bg-purple-50 border-purple-200 text-purple-700",
  tool: "bg-orange-50 border-orange-200 text-orange-700",
};

const roleLabels: Record<string, string> = {
  user: "User",
  assistant: "Assistant",
  system: "System",
  tool: "Tool",
};

export function DebugPromptPanel({ debugInfos, isRunning, className }: DebugPromptPanelProps) {
  const [expandedTurn, setExpandedTurn] = useState<number | null>(null);
  const [copiedPayload, setCopiedPayload] = useState<number | null>(null);
  const [copiedSystem, setCopiedSystem] = useState<number | null>(null);

  const toggleTurn = (iteration: number) => {
    setExpandedTurn((prev) => (prev === iteration ? null : iteration));
  };

  const handleCopyPayload = async (info: DebugInfo) => {
    const payload = {
      systemPrompt: info.systemPrompt,
      messages: info.messages,
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayload(info.iteration);
    setTimeout(() => setCopiedPayload(null), 2000);
  };

  const handleCopySystem = async (text: string, iteration: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedSystem(iteration);
    setTimeout(() => setCopiedSystem(null), 2000);
  };

  const totalTokens = (info: DebugInfo) => {
    const systemLen = info.systemPrompt.length;
    const messagesLen = info.messages.reduce((acc, m) => acc + m.content.length, 0);
    return Math.round((systemLen + messagesLen) / 4);
  };

  return (
    <div className={cn("border border-zinc-200 bg-zinc-50/80 rounded-2xl p-5 space-y-4", className)}>
      <div className="flex items-center gap-2">
        <Code2 className="h-4 w-4 text-zinc-600" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Debug Prompts</h3>
      </div>

      {debugInfos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MessagesSquare className="h-6 w-6 text-zinc-300 mb-2" />
          <p className="text-xs text-zinc-400">No debug snapshots available</p>
        </div>
      ) : (
        <div className="space-y-2">
          {debugInfos.map((info) => {
            const isExpanded = expandedTurn === info.iteration;
            const tokenEstimate = totalTokens(info);

            return (
              <div key={info.iteration} className="border border-zinc-200 bg-white rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleTurn(info.iteration)}
                  className="flex items-center justify-between w-full px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
                  aria-expanded={isExpanded}
                  aria-label={`Toggle turn ${info.iteration} details`}
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight
                      className={cn("h-4 w-4 text-zinc-400 transition-transform", isExpanded && "rotate-90")}
                    />
                    <span className="text-xs font-medium text-zinc-700">Turn {info.iteration}</span>
                    <span className="text-xs text-zinc-400 tabular-nums">~{tokenEstimate} tokens</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyPayload(info);
                    }}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
                    aria-label="Copy entire payload as JSON"
                  >
                    {copiedPayload === info.iteration ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedPayload === info.iteration ? "Copied" : "Copy All"}
                  </button>
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-200 divide-y divide-zinc-100 animate-in slide-in-from-top-1 duration-150">
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                          System Prompt
                        </span>
                        <button
                          onClick={() => handleCopySystem(info.systemPrompt, info.iteration)}
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
                          aria-label="Copy system prompt"
                        >
                          {copiedSystem === info.iteration ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copiedSystem === info.iteration ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <pre className="text-xs text-zinc-700 font-mono bg-zinc-50 p-3 rounded-xl border border-zinc-200 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                        {info.systemPrompt || "(empty)"}
                      </pre>
                    </div>

                    <div className="p-4 space-y-3">
                      <span className="text-xs font-medium text-zinc-500">Message History</span>
                      <div className="space-y-2">
                        {info.messages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "border rounded-xl p-3 space-y-1",
                              roleStyles[msg.role] ?? "bg-zinc-50 border-zinc-200 text-zinc-600",
                            )}
                          >
                            <span className="text-xs font-semibold">{roleLabels[msg.role] ?? msg.role}</span>
                            <p className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
                              {msg.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
