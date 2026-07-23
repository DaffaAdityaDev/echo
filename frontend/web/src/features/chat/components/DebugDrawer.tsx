"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Bug,
  Terminal,
  FileText,
  Coins,
  Database,
  Trash2,
  Download,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Search,
  Filter,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useChatStore, LoggedPacket } from "../stores/chatStore";
import { Button } from "@/components/ui/Button";

interface DebugDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeBadgeColors: Record<string, string> = {
  metadata: "bg-red-500/10 text-red-500 border-red-500/20",
  reasoning: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  content: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  tool_call: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  tool_result: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  debug: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  usage: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  swarm_status: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  error: "bg-red-600/20 text-red-400 border-red-500/30",
};

export function DebugDrawer({ isOpen, onClose }: DebugDrawerProps) {
  const [activeTab, setActiveTab] = useState<"packets" | "prompt" | "usage" | "state">("packets");
  const [packetFilter, setPacketFilter] = useState<string>("all");
  const [packetSearch, setPacketSearch] = useState<string>("");
  const [expandedPacketIndex, setExpandedPacketIndex] = useState<number | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const packetLogs = useChatStore((s) => s.packetLogs);
  const maxPacketLogSize = useChatStore((s) => s.maxPacketLogSize);
  const clearPacketLogs = useChatStore((s) => s.clearPacketLogs);
  const debugPacketHistory = useChatStore((s) => s.debugPacketHistory);
  const cumulativeUsage = useChatStore((s) => s.cumulativeUsage);
  const setMaxPacketLogSize = useChatStore((s) => s.setMaxPacketLogSize);

  const storeState = useChatStore();

  const logsEndRef = useRef<HTMLDivElement>(null);

  // No keyboard shortcut here — handled globally in ChatPage

  const [selectedDebugIdx, setSelectedDebugIdx] = useState<number>(debugPacketHistory.length - 1);
  const effectiveDebugIdx =
    selectedDebugIdx < 0 || selectedDebugIdx >= debugPacketHistory.length
      ? debugPacketHistory.length - 1
      : selectedDebugIdx;
  const activeDebugInfo = debugPacketHistory[effectiveDebugIdx] || null;

  // Copy helper
  const copyToClipboard = (text: string, sectionName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Export JSON helper
  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(packetLogs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `echo-sse-packets-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!isOpen) return null;

  // Filtered packets
  const filteredPackets = packetLogs.filter((p) => {
    const pType = (p as { type?: string }).type;
    const matchesType = packetFilter === "all" || pType === packetFilter;
    const matchesSearch =
      !packetSearch || JSON.stringify(p).toLowerCase().includes(packetSearch.toLowerCase());
    return matchesType && matchesSearch;
  });

  const tabs = [
    { id: "packets", label: "Packets", icon: Terminal, count: packetLogs.length },
    { id: "prompt", label: "Prompt", icon: FileText, badge: debugPacketHistory.length > 0 ? `${debugPacketHistory.length}` : undefined },
    { id: "usage", label: "Usage", icon: Coins, badge: cumulativeUsage ? `${cumulativeUsage.totalTokens}t` : undefined },
    { id: "state", label: "State", icon: Database },
  ] as const;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white/95 dark:bg-zinc-950/95 border-l border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl backdrop-blur-2xl flex flex-col font-sans text-zinc-900 dark:text-zinc-100 select-none animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-200/80 dark:border-zinc-800/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
            <Bug className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold font-display uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
              Agent Debug & Telemetry Drawer
            </h3>
            <span className="text-[10px] text-zinc-400">Shortcut: Ctrl + ` or Ctrl + Shift + D</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 border-b border-zinc-200/60 dark:border-zinc-800/60 shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const count = "count" in tab ? tab.count : undefined;
          const badge = "badge" in tab ? tab.badge : undefined;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer",
                active
                  ? "border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-500/5 font-bold"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {count !== undefined && (
                <span className="ml-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {count}
                </span>
              )}
              {badge && (
                <span className="ml-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-purple-500/10 text-purple-500">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {activeTab === "packets" ? (
          <div className="flex flex-col h-full space-y-3">
            {/* Filter Bar */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter logs by JSON content..."
                  value={packetSearch}
                  onChange={(e) => setPacketSearch(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-purple-500/40"
                />
              </div>

              <select
                value={packetFilter}
                onChange={(e) => setPacketFilter(e.target.value)}
                className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
                style={{ colorScheme: "dark" }}
              >
                <option value="all">All Types</option>
                <option value="metadata">metadata</option>
                <option value="reasoning">reasoning</option>
                <option value="tool_call">tool_call</option>
                <option value="tool_result">tool_result</option>
                <option value="content">content</option>
                <option value="debug">debug</option>
                <option value="usage">usage</option>
                <option value="swarm_status">swarm_status</option>
              </select>
            </div>

            {/* SSE Packet Feed */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px] min-h-0">
              {filteredPackets.length === 0 ? (
                <div className="text-center py-16 text-xs text-zinc-400">
                  No SSE packets logged yet. Send a prompt to inspect live telemetry.
                </div>
              ) : (
                filteredPackets.map((pkt, idx) => {
                  const isExpanded = expandedPacketIndex === idx;
                  const pktType = (pkt as { type?: string }).type || "packet";
                  const badgeStyle = typeBadgeColors[pktType] || "bg-zinc-800 text-zinc-400 border-zinc-700";
                  const dateStr = new Date(pkt.timestamp).toLocaleTimeString();

                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50 overflow-hidden"
                    >
                      <div
                        onClick={() => setExpandedPacketIndex(isExpanded ? null : idx)}
                        className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          )}
                          <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border", badgeStyle)}>
                            {pktType}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-sans shrink-0">{dateStr}</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-3 bg-zinc-950 border-t border-zinc-800 text-zinc-300 overflow-x-auto text-[10px] leading-relaxed">
                          <pre>{JSON.stringify(pkt, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Bottom Footer Actions */}
            <div className="pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={clearPacketLogs}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1"
                  title="Clear Packet Logs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </button>
                <span className="text-zinc-500 text-[10px]">
                  Cap: {packetLogs.length}/{maxPacketLogSize}
                </span>
              </div>

              <button
                onClick={handleExportLogs}
                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors flex items-center gap-1 text-[11px] font-semibold"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>
        ) : activeTab === "prompt" ? (
          <div className="space-y-4">
            {/* Debug turn selector */}
            {debugPacketHistory.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto">
                {debugPacketHistory.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDebugIdx(i)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer whitespace-nowrap ${
                      i === effectiveDebugIdx
                        ? "bg-purple-500/20 text-purple-400 border-purple-500/40"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white"
                    }`}
                  >
                    Turn {i + 1}
                  </button>
                ))}
              </div>
            )}

            {/* System Prompt Inspector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Raw System Prompt & Tool Schemas
                </h4>
                {activeDebugInfo?.systemPrompt && (
                  <button
                    onClick={() => copyToClipboard(activeDebugInfo.systemPrompt || "", "prompt")}
                    className="p-1 rounded text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    {copiedSection === "prompt" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>Copy</span>
                  </button>
                )}
              </div>

              {activeDebugInfo?.systemPrompt ? (
                <pre className="p-3 bg-zinc-950 text-zinc-200 rounded-2xl border border-zinc-800 text-[11px] font-mono whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">
                  {activeDebugInfo.systemPrompt}
                </pre>
              ) : (
                <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 text-xs text-zinc-400 italic text-center">
                  No system prompt captured yet. Run an agent query to capture backend debug packets.
                </div>
              )}
            </div>

            {/* Message History Inspector */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Raw Message History Payload ({activeDebugInfo?.historyLength || 0} items)
              </h4>
              {activeDebugInfo?.rawMessages ? (
                <pre className="p-3 bg-zinc-950 text-zinc-200 rounded-2xl border border-zinc-800 text-[11px] font-mono whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                  {JSON.stringify(activeDebugInfo.rawMessages, null, 2)}
                </pre>
              ) : (
                <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 text-xs text-zinc-400 italic text-center">
                  No message history telemetry captured yet.
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "usage" ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/40 space-y-4">
              <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Token Consumption Breakdown
              </h4>

              {cumulativeUsage ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-zinc-400">
                      <span>Prompt Tokens</span>
                      <span className="font-mono font-bold text-white">{cumulativeUsage.promptTokens}</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full"
                        style={{
                          width: `${Math.min(
                            (cumulativeUsage.promptTokens / Math.max(cumulativeUsage.totalTokens, 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-zinc-400">
                      <span>Completion Tokens</span>
                      <span className="font-mono font-bold text-white">{cumulativeUsage.completionTokens}</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-purple-500 h-full rounded-full"
                        style={{
                          width: `${Math.min(
                            (cumulativeUsage.completionTokens / Math.max(cumulativeUsage.totalTokens, 1)) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between pt-2 border-t border-zinc-800 text-xs font-bold">
                    <span>Total Session Tokens</span>
                    <span className="font-mono text-purple-400">{cumulativeUsage.totalTokens}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic">No usage packets recorded for active session.</p>
              )}
            </div>
          </div>
        ) : (
          /* State Tab: Live Zustand Dump & Config */
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Live Zustand Store Snapshot
              </h4>
              <pre className="p-3 bg-zinc-950 text-zinc-200 rounded-2xl border border-zinc-800 text-[11px] font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
                {JSON.stringify(
                  {
                    agentState: storeState.agentState,
                    agentProgress: storeState.agentProgress ? {
                      iteration: storeState.agentProgress.iteration,
                      totalIterations: storeState.agentProgress.totalIterations,
                      currentTool: storeState.agentProgress.currentTool,
                      statusMessage: storeState.agentProgress.statusMessage,
                    } : null,
                    selectedModel: storeState.selectedModel,
                    mode: storeState.mode,
                    selectedFeatures: storeState.selectedFeatures,
                    messagesCount: storeState.messages.length,
                    activeSessionId: storeState.activeSessionId,
                    sessionsCount: storeState.sessions.length,
                    packetLogsCount: storeState.packetLogs.length,
                    maxPacketLogSize: storeState.maxPacketLogSize,
                    debugSnapshots: storeState.debugPacketHistory.length,
                    cumulativeUsage: storeState.cumulativeUsage,
                    missionMeta: storeState.missionMeta,
                  },
                  null,
                  2
                )}
              </pre>
            </div>

            {/* Configurable Ring Buffer Limit */}
            <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/40 space-y-2">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                Packet Log Buffer Limit
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={maxPacketLogSize}
                  onChange={(e) => setMaxPacketLogSize(Number(e.target.value) || 100)}
                  className="w-32 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                />
                <span className="text-[11px] text-zinc-400">Max SSE events held in RAM</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
