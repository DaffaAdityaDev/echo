"use client";

import { Database } from "lucide-react";
import { CopyButton } from "@/components/ui/CopyButton";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { useChatStore } from "../../stores/chatStore";

export function StoreStatePanel() {
  const agentState = useChatStore((s) => s.agentState);
  const agentProgress = useChatStore((s) => s.agentProgress);
  const messages = useChatStore((s) => s.messages);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const sessions = useChatStore((s) => s.sessions);
  const packetLogs = useChatStore((s) => s.packetLogs);
  const maxPacketLogSize = useChatStore((s) => s.maxPacketLogSize);
  const debugPacketHistory = useChatStore((s) => s.debugPacketHistory);
  const cumulativeUsage = useChatStore((s) => s.cumulativeUsage);
  const setMaxPacketLogSize = useChatStore((s) => s.setMaxPacketLogSize);
  const { defaultModel, defaultMode, defaultFeatures } = useSettingsStore((s) => s.config);

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
      defaultModel,
      defaultMode,
      defaultFeatures,
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
            <Database className="h-4 w-4 text-accent" aria-hidden="true" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Live Zustand Frontend Store Snapshot
            </h3>
          </div>
          <CopyButton
            text={storeSnapshot}
            label="Copy Store State"
            className="px-2.5 py-1 rounded-sm text-xs bg-surface-hover hover:bg-border text-foreground border border-border shrink-0"
          />
        </div>

        <pre className="p-4 bg-code text-code-foreground rounded-md border border-code-border text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed select-text">
          {storeSnapshot}
        </pre>
      </div>

      <div className="p-4 rounded-md border border-border bg-surface space-y-3">
        <label
          htmlFor="packet-buffer-limit"
          className="text-xs font-bold text-foreground uppercase tracking-wider block"
        >
          Packet Log Buffer RAM Capacity
        </label>
        <div className="flex items-center gap-3">
          <input
            id="packet-buffer-limit"
            type="number"
            value={maxPacketLogSize}
            onChange={(e) => setMaxPacketLogSize(Number(e.target.value) || 100)}
            aria-describedby="packet-buffer-limit-hint"
            className="w-32 bg-elevated border border-border-strong rounded-sm px-3.5 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-accent/50"
          />
          <span id="packet-buffer-limit-hint" className="text-xs text-muted">
            Max SSE events stored in browser RAM buffer
          </span>
        </div>
      </div>
    </div>
  );
}
