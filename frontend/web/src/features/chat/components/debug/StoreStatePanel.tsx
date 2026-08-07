"use client";

import { Database } from "lucide-react";
import { CopyButton } from "@/components/ui/CopyButton";
import { useChatStore } from "../../stores/chatStore";

export function StoreStatePanel() {
  const agentState = useChatStore((s) => s.agentState);
  const agentProgress = useChatStore((s) => s.agentProgress);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const mode = useChatStore((s) => s.mode);
  const selectedFeatures = useChatStore((s) => s.selectedFeatures);
  const messages = useChatStore((s) => s.messages);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const sessions = useChatStore((s) => s.sessions);
  const packetLogs = useChatStore((s) => s.packetLogs);
  const maxPacketLogSize = useChatStore((s) => s.maxPacketLogSize);
  const debugPacketHistory = useChatStore((s) => s.debugPacketHistory);
  const cumulativeUsage = useChatStore((s) => s.cumulativeUsage);
  const setMaxPacketLogSize = useChatStore((s) => s.setMaxPacketLogSize);

  const storeSnapshot = JSON.stringify(
    {
      agentState,
      agentProgress: agentProgress
        ? {
            iteration: agentProgress.iteration,
            totalIterations: agentProgress.totalIterations,
            currentTool: agentProgress.currentTool,
            statusMessage: agentProgress.statusMessage,
          }
        : null,
      selectedModel,
      mode,
      selectedFeatures,
      messagesCount: messages.length,
      activeSessionId,
      sessionsCount: sessions.length,
      packetLogsCount: packetLogs.length,
      maxPacketLogSize,
      debugSnapshots: debugPacketHistory.length,
      cumulativeUsage,
    },
    null,
    2,
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-300 uppercase tracking-wider">
              Live Zustand Frontend Store Snapshot
            </h4>
          </div>
          <CopyButton
            text={storeSnapshot}
            label="Copy Store State"
            className="px-2.5 py-1 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800"
          />
        </div>

        <pre className="p-4 bg-zinc-900 dark:bg-zinc-950 text-zinc-100 dark:text-zinc-200 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed select-text">
          {storeSnapshot}
        </pre>
      </div>

      {/* Configurable Ring Buffer Limit */}
      <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-3">
        <label
          htmlFor="packet-buffer-limit"
          className="text-xs font-bold text-zinc-800 dark:text-zinc-300 uppercase tracking-wider block"
        >
          Packet Log Buffer RAM Capacity
        </label>
        <div className="flex items-center gap-3">
          <input
            id="packet-buffer-limit"
            type="number"
            value={maxPacketLogSize}
            onChange={(e) => setMaxPacketLogSize(Number(e.target.value) || 100)}
            className="w-32 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-1.5 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-purple-500/50"
          />
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Max SSE events stored in browser RAM buffer
          </span>
        </div>
      </div>
    </div>
  );
}
