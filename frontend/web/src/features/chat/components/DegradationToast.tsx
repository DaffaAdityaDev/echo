"use client";

import React, { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useChatStore } from "../stores/chatStore";

export function DegradationToast() {
  const agentState = useChatStore((s) => s.agentState);
  const [dismissed, setDismissed] = useState(false);

  const visible = agentState === 'degraded' && !dismissed;

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setDismissed(true), 8000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const dismiss = () => setDismissed(true);

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm bg-red-500/10 border border-red-500/30 rounded-xl p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-red-400">Agent Degraded</p>
          <p className="text-xs text-red-300/70 mt-1">
            Agent is operating in degraded mode
          </p>
        </div>
        <button
          onClick={dismiss}
          className="p-1 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
