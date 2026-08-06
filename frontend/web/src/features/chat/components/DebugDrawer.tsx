"use client";

import {
  Activity,
  Bug,
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  Copy,
  Cpu,
  Database,
  Download,
  FileText,
  Filter,
  Flame,
  Gauge,
  Layers,
  Maximize2,
  PieChart,
  Search,
  Sparkles,
  Terminal,
  Trash2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { PACKET_TYPES } from "../constants";
import { LoggedPacket, useChatStore } from "../stores/chatStore";

interface DebugDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeBadgeColors: Record<string, string> = {
  metadata: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  reasoning: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  content: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  tool_call: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  tool_result: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  debug: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  usage: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  swarm_status: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  error: "bg-red-600/20 text-red-600 dark:text-red-400 border-red-500/30 font-bold",
};

export function DebugDrawer({ isOpen, onClose }: DebugDrawerProps) {
  const [activeTab, setActiveTab] = useState<"packets" | "prompt" | "usage" | "state">("packets");
  const [packetFilter, setPacketFilter] = useState<string>("all");
  const [packetSearch, setPacketSearch] = useState<string>("");
  const [promptSearch, setPromptSearch] = useState<string>("");
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
    downloadAnchor.setAttribute("download", `echo-telemetry-packets-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!isOpen) return null;

  // Filtered packets
  const filteredPackets = packetLogs.filter((p) => {
    const pType = (p as { type?: string }).type;
    const matchesType = packetFilter === "all" || pType === packetFilter;
    const matchesSearch = !packetSearch || JSON.stringify(p).toLowerCase().includes(packetSearch.toLowerCase());
    return matchesType && matchesSearch;
  });

  const packetTypesList = ["all", ...Object.values(PACKET_TYPES)];

  const tabs = [
    { id: "packets", label: "Packets", icon: Terminal, count: packetLogs.length },
    {
      id: "prompt",
      label: "Prompt & Harness",
      icon: FileText,
      badge: debugPacketHistory.length > 0 ? `${debugPacketHistory.length}` : undefined,
    },
    {
      id: "usage",
      label: "Metrics & Cache",
      icon: Coins,
      badge: cumulativeUsage ? `${cumulativeUsage.totalTokens}t` : undefined,
    },
    { id: "state", label: "Store State", icon: Database },
  ] as const;

  // Analyze active prompt to extract metadata dynamically
  const systemPromptText = activeDebugInfo?.systemPrompt || "";
  const isDirectMode = systemPromptText.includes("DIRECT MODE");
  const isCoordinatorMode = systemPromptText.includes("COORDINATOR MODE");
  const executionModeLabel = isCoordinatorMode ? "COORDINATOR MODE" : isDirectMode ? "DIRECT MODE" : "STANDARD";
  
  // Check if system prompt contains custom prompt or default behavior
  const hasCustomBehavior = systemPromptText.length > 0 && !systemPromptText.includes("RESEARCH WORKFLOW INSTRUCTIONS:");

  // Advanced Usage & Cache Metrics Calculations
  const promptTokens = cumulativeUsage?.promptTokens || 0;
  const completionTokens = cumulativeUsage?.completionTokens || 0;
  const totalTokens = cumulativeUsage?.totalTokens || 0;
  const cachedTokens = cumulativeUsage?.cachedTokens || 0;
  const reasoningTokens = cumulativeUsage?.reasoningTokens || 0;

  const cacheHitRatio = promptTokens > 0 ? ((cachedTokens / promptTokens) * 100).toFixed(1) : "0.0";
  const nonCachedPromptTokens = Math.max(0, promptTokens - cachedTokens);

  // Model Context Window capacity sent 100% directly from Provider SSE Packet
  const maxContextWindow = cumulativeUsage?.maxContextTokens || 0;
  const contextUtilization = maxContextWindow > 0 ? ((totalTokens / maxContextWindow) * 100).toFixed(2) : "0.00";
  const contextLabel = maxContextWindow >= 1000000 ? `${(maxContextWindow / 1000000).toFixed(0)}M` : `${(maxContextWindow / 1000).toFixed(0)}k`;

  // Estimated Cost — dikirim agent dari packet usage (calculateUsageCost, tarif per-model)
  const estimatedCost = (cumulativeUsage?.estimatedCostUsd ?? 0).toFixed(5);

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
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Shortcut: <kbd className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono text-[9px]">Ctrl + `</kbd> or <kbd className="px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-mono text-[9px]">Ctrl + Shift + D</kbd></p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => copyToClipboard(JSON.stringify({
              debugHistory: debugPacketHistory,
              storeState: {
                selectedModel: storeState.selectedModel,
                mode: storeState.mode,
                activeSessionId: storeState.activeSessionId,
                cumulativeUsage: storeState.cumulativeUsage,
              },
              packetLogs,
            }, null, 2), "telemetry")}
            className="px-2.5 py-1 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1.5 font-medium border border-zinc-200/80 dark:border-zinc-700/60 cursor-pointer"
            title="Copy full telemetry dump"
          >
            {copiedSection === "telemetry" ? (
              <>
                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy Dump</span>
              </>
            )}
          </button>
          <button
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
          const count = "count" in tab ? tab.count : undefined;
          const badge = "badge" in tab ? tab.badge : undefined;
          return (
            <button
              key={tab.id}
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
          <div className="flex flex-col h-full space-y-3">
            {/* Filter Bar & Quick Pills */}
            <div className="space-y-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filter packets by JSON text..."
                    value={packetSearch}
                    onChange={(e) => setPacketSearch(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>
                <button
                  onClick={() => setPacketSearch("")}
                  className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  Clear Search
                </button>
              </div>

              {/* Quick Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {packetTypesList.map((ptype) => (
                  <button
                    key={ptype}
                    onClick={() => setPacketFilter(ptype)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all border cursor-pointer whitespace-nowrap",
                      packetFilter === ptype
                        ? "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/50 shadow-sm"
                        : "bg-zinc-100 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200",
                    )}
                  >
                    {ptype}
                  </button>
                ))}
              </div>
            </div>

            {/* SSE Packet Feed */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px] min-h-0">
              {filteredPackets.length === 0 ? (
                <div className="text-center py-20 text-xs text-zinc-400 dark:text-zinc-500 space-y-2">
                  <Terminal className="h-8 w-8 mx-auto text-zinc-400 dark:text-zinc-700" />
                  <p>No SSE telemetry packets captured matching filters.</p>
                </div>
              ) : (
                filteredPackets.map((pkt, idx) => {
                  const isExpanded = expandedPacketIndex === idx;
                  const pktType = (pkt as { type?: string }).type || "packet";
                  const badgeStyle = typeBadgeColors[pktType] || "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700";
                  const dateStr = new Date(pkt.timestamp).toLocaleTimeString();

                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/40 overflow-hidden transition-all hover:border-zinc-300 dark:hover:border-zinc-700/80"
                    >
                      <div
                        onClick={() => setExpandedPacketIndex(isExpanded ? null : idx)}
                        className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          )}
                          <span
                            className={cn("px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border", badgeStyle)}
                          >
                            {pktType}
                          </span>
                          <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-sans truncate">
                            {JSON.stringify(pkt).slice(0, 70)}...
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0 ml-2">{dateStr}</span>
                      </div>

                      {isExpanded && (
                        <div className="p-3 bg-zinc-900 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800/80 text-zinc-200 dark:text-zinc-300 overflow-x-auto text-[10px] leading-relaxed relative group">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(JSON.stringify(pkt, null, 2), `pkt-${idx}`);
                            }}
                            className="absolute top-2 right-2 px-2 py-1 bg-zinc-800 dark:bg-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-800 border border-zinc-700 rounded text-[9px] text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            {copiedSection === `pkt-${idx}` ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span>{copiedSection === `pkt-${idx}` ? "Copied" : "Copy Packet"}</span>
                          </button>
                          <pre className="font-mono text-zinc-100 dark:text-zinc-200">{JSON.stringify(pkt, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Bottom Footer Actions */}
            <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between text-xs shrink-0 bg-zinc-50/80 dark:bg-zinc-950/80">
              <div className="flex items-center gap-3">
                <button
                  onClick={clearPacketLogs}
                  className="px-2.5 py-1 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Clear Packet Logs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear Feed</span>
                </button>
                <span className="text-zinc-500 text-[10px] font-mono">
                  Buffer: {packetLogs.length} / {maxPacketLogSize} events
                </span>
              </div>

              <button
                onClick={handleExportLogs}
                className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all flex items-center gap-1.5 text-xs font-semibold shadow-sm cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                <span>Export Telemetry JSON</span>
              </button>
            </div>
          </div>
        ) : activeTab === "prompt" ? (
          <div className="space-y-4">
            {/* Active Harness Telemetry Overview Card */}
            <div className="p-4 rounded-2xl border border-purple-500/30 dark:border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-zinc-50/80 dark:via-zinc-900/50 to-zinc-100/40 dark:to-zinc-900/30 space-y-3 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    Resolved System Prompt Metadata
                  </h4>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40">
                  {executionModeLabel}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-medium">Execution Mode</span>
                  <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">{executionModeLabel}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-medium">Custom Prompt State</span>
                  <span className="text-xs font-bold font-mono text-purple-700 dark:text-purple-300">
                    {hasCustomBehavior ? "Promoted DB Version" : "Default NLAH Base"}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-medium">Captured Turns</span>
                  <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">{debugPacketHistory.length} turns</span>
                </div>
              </div>
            </div>

            {/* Debug turn selector */}
            {debugPacketHistory.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 shrink-0">Select Turn:</span>
                {debugPacketHistory.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDebugIdx(i)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer whitespace-nowrap transition-all",
                      i === effectiveDebugIdx
                        ? "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/50 shadow-sm"
                        : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800",
                    )}
                  >
                    Turn {i + 1}
                  </button>
                ))}
              </div>
            )}

            {/* System Prompt Inspector with Search */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-300 uppercase tracking-wider">
                    Raw Assembled System Prompt & Schemas
                  </h4>
                </div>

                {activeDebugInfo?.systemPrompt && (
                  <button
                    onClick={() => copyToClipboard(activeDebugInfo.systemPrompt || "", "prompt")}
                    className="px-2.5 py-1 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
                  >
                    {copiedSection === "prompt" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Prompt</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Prompt Search Filter */}
              {activeDebugInfo?.systemPrompt && (
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search inside system prompt text (e.g. CORE PROTOCOLS, NYA-CAT)..."
                    value={promptSearch}
                    onChange={(e) => setPromptSearch(e.target.value)}
                    className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              )}

              {activeDebugInfo?.systemPrompt ? (
                <div className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-900 dark:bg-zinc-950 overflow-hidden">
                  <pre className="p-4 text-zinc-100 dark:text-zinc-200 text-[11px] font-mono whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed select-text">
                    {systemPromptText}
                  </pre>
                </div>
              ) : (
                <div className="p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 text-xs text-zinc-500 dark:text-zinc-400 italic text-center space-y-2">
                  <FileText className="h-6 w-6 mx-auto text-zinc-400 dark:text-zinc-600" />
                  <p>No system prompt telemetry captured yet. Send an agent query to record backend debug packets.</p>
                </div>
              )}
            </div>

            {/* Message History Inspector */}
            <div className="space-y-2 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-300 uppercase tracking-wider">
                  Raw Message History Payload ({activeDebugInfo?.historyLength || 0} items)
                </h4>
                {activeDebugInfo?.rawMessages && (
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(activeDebugInfo.rawMessages, null, 2), "history")}
                    className="px-2.5 py-1 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
                  >
                    {copiedSection === "history" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy History Payload</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              {activeDebugInfo?.rawMessages ? (
                <pre className="p-4 bg-zinc-900 dark:bg-zinc-950 text-zinc-100 dark:text-zinc-200 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed select-text">
                  {JSON.stringify(activeDebugInfo.rawMessages, null, 2)}
                </pre>
              ) : (
                <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 text-xs text-zinc-500 dark:text-zinc-400 italic text-center">
                  No message history payload captured yet.
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "usage" ? (
          <div className="space-y-4">
            {/* Top Stat Cards Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* KV Prompt Cache Read */}
              <div className="p-4 rounded-2xl border border-emerald-500/30 dark:border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" /> KV Cache Hits / Read
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    {cacheHitRatio}% SAVED
                  </span>
                </div>
                <div className="text-xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  {cachedTokens.toLocaleString()}{" "}
                  <span className="text-xs text-zinc-500 font-sans font-normal">/ {promptTokens.toLocaleString()} tokens</span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Tokens served directly from KV Prefix Cache (50-80% faster response).
                </p>
              </div>

              {/* Estimated USD Cost */}
              <div className="p-4 rounded-2xl border border-purple-500/30 dark:border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5" /> Est. Session Cost
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-purple-500/20 text-purple-700 dark:text-purple-300 font-mono">
                    USD
                  </span>
                </div>
                <div className="text-xl font-extrabold font-mono text-purple-600 dark:text-purple-300">
                  ${estimatedCost}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Calculated using active model input, output & cache read rates.
                </p>
              </div>
            </div>

            {/* Comprehensive Context & Breakdown Panel */}
            <div className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    Context Window & Token Breakdown
                  </h4>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {maxContextWindow > 0 ? `${contextUtilization}% of ${contextLabel} Window` : "Limit Not Specified by Provider"}
                </span>
              </div>

              {/* Grid 4 Columns */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-medium">Input Context</span>
                  <span className="text-sm font-extrabold font-mono text-blue-600 dark:text-blue-400">
                    {promptTokens.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-zinc-400 block mt-0.5 font-mono">
                    {nonCachedPromptTokens.toLocaleString()} fresh
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-medium">Output Generated</span>
                  <span className="text-sm font-extrabold font-mono text-purple-600 dark:text-purple-400">
                    {completionTokens.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-zinc-400 block mt-0.5 font-mono">
                    Completion
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-medium">KV Cache Read</span>
                  <span className="text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                    {cachedTokens.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-zinc-400 block mt-0.5 font-mono">
                    {cacheHitRatio}% hit rate
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block font-medium">Reasoning CoT</span>
                  <span className="text-sm font-extrabold font-mono text-amber-600 dark:text-amber-400">
                    {reasoningTokens.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-zinc-400 block mt-0.5 font-mono">
                    Thought tokens
                  </span>
                </div>
              </div>

              {/* Progress bars */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    <span>Input Context Ratio (System Prompt + History)</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {((promptTokens / Math.max(totalTokens, 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-300/60 dark:border-zinc-800">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          (promptTokens / Math.max(totalTokens, 1)) * 100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    <span>Output Generation Ratio</span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                      {((completionTokens / Math.max(totalTokens, 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-300/60 dark:border-zinc-800">
                    <div
                      className="bg-purple-500 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          (completionTokens / Math.max(totalTokens, 1)) * 100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Context Capacity Utilization */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    <span>Model Context Capacity Utilization</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {maxContextWindow > 0
                        ? `${totalTokens.toLocaleString()} / ${maxContextWindow.toLocaleString()} (${contextUtilization}%)`
                        : `${totalTokens.toLocaleString()} tokens (Not Specified by Provider)`}
                    </span>
                  </div>
                  {maxContextWindow > 0 && (
                    <div className="w-full bg-zinc-200 dark:bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-zinc-300/60 dark:border-zinc-800">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            (totalTokens / maxContextWindow) * 100,
                            100,
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* State Tab: Live Zustand Store Inspector */
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-300 uppercase tracking-wider">
                    Live Zustand Frontend Store Snapshot
                  </h4>
                </div>
                <button
                  onClick={() => copyToClipboard(JSON.stringify({
                    agentState: storeState.agentState,
                    agentProgress: storeState.agentProgress,
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
                  }, null, 2), "store")}
                  className="px-2.5 py-1 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
                >
                  {copiedSection === "store" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Store State</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 bg-zinc-900 dark:bg-zinc-950 text-zinc-100 dark:text-zinc-200 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed select-text">
                {JSON.stringify(
                  {
                    agentState: storeState.agentState,
                    agentProgress: storeState.agentProgress
                      ? {
                          iteration: storeState.agentProgress.iteration,
                          totalIterations: storeState.agentProgress.totalIterations,
                          currentTool: storeState.agentProgress.currentTool,
                          statusMessage: storeState.agentProgress.statusMessage,
                        }
                      : null,
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
                  },
                  null,
                  2,
                )}
              </pre>
            </div>

            {/* Configurable Ring Buffer Limit */}
            <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-3">
              <label className="text-xs font-bold text-zinc-800 dark:text-zinc-300 uppercase tracking-wider block">
                Packet Log Buffer RAM Capacity
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={maxPacketLogSize}
                  onChange={(e) => setMaxPacketLogSize(Number(e.target.value) || 100)}
                  className="w-32 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3.5 py-1.5 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-purple-500/50"
                />
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Max SSE events stored in browser RAM buffer</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
