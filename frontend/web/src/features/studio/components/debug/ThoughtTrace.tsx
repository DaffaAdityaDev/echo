"use client";

import { Brain, Sparkles, X } from "lucide-react";
import React, { useCallback, useEffect } from "react";
import { cn } from "@/utils/cn";

interface ThoughtTraceProps {
  reasoning: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  isOpen: boolean;
  onClose: () => void;
}

export function ThoughtTrace({ reasoning, toolName, toolArgs, isOpen, onClose }: ThoughtTraceProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Reasoning trace"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white border border-zinc-200 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-zinc-800">
              {toolName ? `${toolName} Reasoning Trace` : "Reasoning Trace"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors"
            aria-label="Close reasoning trace"
          >
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!reasoning ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
              <Sparkles className="h-8 w-8 text-zinc-300" />
              <p className="text-sm text-zinc-500">No reasoning trace available for this step</p>
            </div>
          ) : (
            <>
              {toolArgs && Object.keys(toolArgs).length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-zinc-500">Arguments</span>
                  <pre className="text-xs text-zinc-600 font-mono bg-zinc-50 p-3 rounded-xl border border-zinc-200 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                    {JSON.stringify(toolArgs, null, 2)}
                  </pre>
                </div>
              )}
              <div className="space-y-1">
                <span className="text-xs font-medium text-zinc-500">Reasoning</span>
                <pre className="text-xs text-amber-800 font-mono bg-amber-50 p-4 rounded-xl border border-amber-200 whitespace-pre-wrap break-all leading-relaxed">
                  {reasoning}
                </pre>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end px-5 py-3 border-t border-zinc-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
