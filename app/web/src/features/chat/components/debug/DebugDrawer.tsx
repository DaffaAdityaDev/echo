"use client";

import { Activity, Bug, Coins, Database, FileText, Terminal, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { Kbd } from "@/components/ui/Kbd";
import { type TabItem, Tabs, tabElementId } from "@/components/ui/Tabs";
import { useTraceStore } from "@/features/debug/stores/traceStore";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { useChatStore } from "../../stores/chatStore";
import { PacketLogsPanel } from "./PacketLogsPanel";
import { PromptInspectorPanel } from "./PromptInspectorPanel";
import { StoreStatePanel } from "./StoreStatePanel";
import { TracesPanel } from "./TracesPanel";
import { UsageMetricsPanel } from "./UsageMetricsPanel";

interface DebugDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = "traces" | "packets" | "prompt" | "usage" | "state";

function CountChip({ value }: { value: number }) {
  return (
    <span className="ml-1 text-2xs font-mono px-1.5 py-0.5 rounded-full bg-surface-hover text-foreground border border-border-strong">
      {value}
    </span>
  );
}

function AccentChip({ value }: { value: string | undefined }) {
  if (!value) return null;

  return (
    <span className="ml-1 text-2xs font-mono px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
      {value}
    </span>
  );
}

function ActivePanel({ tab }: { tab: TabId }) {
  switch (tab) {
    case "traces":
      return <TracesPanel />;
    case "packets":
      return <PacketLogsPanel />;
    case "prompt":
      return <PromptInspectorPanel />;
    case "usage":
      return <UsageMetricsPanel />;
    case "state":
      return <StoreStatePanel />;
  }
}

function useEscapeToClose(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);
}

export function DebugDrawer({ isOpen, onClose }: DebugDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("traces");
  const panelId = useId();

  const packetLogs = useChatStore((s) => s.packetLogs);
  const debugPacketHistory = useChatStore((s) => s.debugPacketHistory);
  const cumulativeUsage = useChatStore((s) => s.cumulativeUsage);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const traces = useTraceStore((s) => s.traces);
  const { defaultModel, defaultMode } = useSettingsStore((s) => s.config);

  useEscapeToClose(isOpen, onClose);

  if (!isOpen) return null;

  const telemetryDump = JSON.stringify(
    {
      traces,
      debugHistory: debugPacketHistory,
      storeState: {
        defaultModel,
        defaultMode,
        activeSessionId,
        cumulativeUsage,
      },
      packetLogs,
    },
    null,
    2,
  );

  const promptBadge = debugPacketHistory.length > 0 ? `${debugPacketHistory.length}` : undefined;
  const usageBadge = cumulativeUsage ? `${cumulativeUsage.totalTokens}t` : undefined;

  const tabs: readonly TabItem<TabId>[] = [
    { id: "traces", label: "Traces", icon: Activity, trailing: <CountChip value={traces.length} /> },
    { id: "packets", label: "Packets", icon: Terminal, trailing: <CountChip value={packetLogs.length} /> },
    { id: "prompt", label: "Prompt & Harness", icon: FileText, trailing: <AccentChip value={promptBadge} /> },
    { id: "usage", label: "Metrics & Cache", icon: Coins, trailing: <AccentChip value={usageBadge} /> },
    { id: "state", label: "Store State", icon: Database },
  ];

  return (
    <aside
      aria-labelledby={`${panelId}-title`}
      className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-elevated border-l border-border shadow-2xl flex flex-col font-sans text-foreground animate-in slide-in-from-right duration-300"
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-md bg-accent/10 border border-accent/30 text-accent shrink-0">
            <Bug className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2
                id={`${panelId}-title`}
                className="text-xs font-bold font-display uppercase tracking-wider text-foreground truncate"
              >
                Agent Telemetry & System Prompt Drawer
              </h2>
              <span className="px-2 py-0.5 rounded-full text-2xs font-extrabold uppercase bg-accent/15 text-accent border border-accent/30">
                LIVE
              </span>
            </div>
            <p className="hidden sm:block text-2xs text-muted mt-0.5">
              Shortcut: <Kbd>Ctrl + `</Kbd> or <Kbd>Ctrl + Shift + D</Kbd>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <CopyButton
            text={telemetryDump}
            label="Copy Dump"
            className="px-2.5 py-1 rounded-sm text-xs bg-surface-hover hover:bg-border text-foreground font-medium border border-border"
            title="Copy full telemetry dump"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close debug drawer"
            className="p-1.5 rounded-sm text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-2.5 border-b border-border bg-surface shrink-0 overflow-x-auto">
        <Tabs
          tabs={tabs}
          active={activeTab}
          onChange={setActiveTab}
          ariaLabel="Debug panels"
          panelId={panelId}
          className="gap-1 min-w-max"
          itemClassName="px-3.5 py-2 rounded-t-sm whitespace-nowrap"
        />
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabElementId(panelId, activeTab)}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-background"
      >
        <ActivePanel tab={activeTab} />
      </div>
    </aside>
  );
}
