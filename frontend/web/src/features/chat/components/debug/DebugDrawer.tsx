"use client";

import { Bug, Coins, Database, FileText, Terminal, X } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { Kbd } from "@/components/ui/Kbd";
import { cn } from "@/utils/cn";
import { useChatStore } from "../../stores/chatStore";
import { PacketLogsPanel } from "./PacketLogsPanel";
import { PromptInspectorPanel } from "./PromptInspectorPanel";
import { StoreStatePanel } from "./StoreStatePanel";
import { UsageMetricsPanel } from "./UsageMetricsPanel";

interface DebugDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const tabs = [
  { id: "packets", label: "Packets", icon: Terminal, count: "count" },
  { id: "prompt", label: "Prompt & Harness", icon: FileText, badge: "promptBadge" },
  { id: "usage", label: "Metrics & Cache", icon: Coins, badge: "usageBadge" },
  { id: "state", label: "Store State", icon: Database },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function DebugDrawer({ isOpen, onClose }: DebugDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("packets");

  const packetLogs = useChatStore((s) => s.packetLogs);
  const debugPacketHistory = useChatStore((s) => s.debugPacketHistory);
  const cumulativeUsage = useChatStore((s) => s.cumulativeUsage);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const mode = useChatStore((s) => s.mode);
  const activeSessionId = useChatStore((s) => s.activeSessionId);

  if (!isOpen) return null;

  const telemetryDump = JSON.stringify(
    {
      debugHistory: debugPacketHistory,
      storeState: {
        selectedModel,
        mode,
        activeSessionId,
        cumulativeUsage,
      },
      packetLogs,
    },
    null,
    2,
  );

  const tabData = {
    count: packetLogs.length,
    promptBadge: debugPacketHistory.length > 0 ? `${debugPacketHistory.length}` : undefined,
    usageBadge: cumulativeUsage ? `${cumulativeUsage.totalTokens}t` : undefined,
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white/98 dark:bg-zinc-950/98 border-l border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl backdrop-blur-2xl flex flex-col font-sans text-zinc-900 dark:text-zinc-100 select-none animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 shadow-sm shadow-purple-500/10">
            <Bug className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold font-display uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                Agent Telemetry & System Prompt Drawer
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                LIVE
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Shortcut: <Kbd>Ctrl + `</Kbd> or <Kbd>Ctrl + Shift + D</Kbd>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CopyButton
            text={telemetryDump}
            label="Copy Dump"
            className="px-2.5 py-1 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium border border-zinc-200/80 dark:border-zinc-700/60"
            title="Copy full telemetry dump"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 px-4 pt-2.5 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-950/40 shrink-0 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const count = "count" in tab ? tabData[tab.count] : undefined;
          const badge = "badge" in tab ? tabData[tab.badge] : undefined;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer whitespace-nowrap",
                active
                  ? "border-purple-600 dark:border-purple-500 text-purple-700 dark:text-purple-400 bg-purple-500/10 font-bold shadow-sm"
                  : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/60",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {count !== undefined && (
                <span className="ml-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300/60 dark:border-zinc-700/60">
                  {count}
                </span>
              )}
              {badge && (
                <span className="ml-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-white/40 dark:bg-zinc-950/60">
        {activeTab === "packets" ? (
          <PacketLogsPanel />
        ) : activeTab === "prompt" ? (
          <PromptInspectorPanel />
        ) : activeTab === "usage" ? (
          <UsageMetricsPanel />
        ) : (
          <StoreStatePanel />
        )}
      </div>
    </div>
  );
}
