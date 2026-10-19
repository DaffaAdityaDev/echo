"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useChatStore } from "../stores/chatStore";

export function DegradationToast() {
  const agentState = useChatStore((s) => s.agentState);
  const [dismissed, setDismissed] = useState(false);
  const [prevAgentState, setPrevAgentState] = useState(agentState);

  if (agentState !== prevAgentState) {
    setPrevAgentState(agentState);

    if (agentState === "degraded") setDismissed(false);
  }

  const visible = agentState === "degraded" && !dismissed;

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setDismissed(true), 8000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const dismiss = () => setDismissed(true);

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="fixed top-4 right-4 left-4 sm:left-auto z-50 sm:max-w-sm bg-elevated border border-danger/40 rounded-md p-4 shadow-xl"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-danger">Agent Degraded</p>
          <p className="text-xs text-muted mt-1">Agent is operating in degraded mode</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="p-1 rounded-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors shrink-0 cursor-pointer"
          aria-label="Dismiss degraded mode alert"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
