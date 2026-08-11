"use client";

import { ChevronDown, ChevronRight, Download, Search, Terminal, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { cn } from "@/utils/cn";
import { downloadJson } from "@/utils/download";
import { PACKET_TYPES } from "../../constants";
import { useChatStore } from "../../stores/chatStore";

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

export function PacketLogsPanel() {
  const packetLogs = useChatStore((s) => s.packetLogs);
  const maxPacketLogSize = useChatStore((s) => s.maxPacketLogSize);
  const clearPacketLogs = useChatStore((s) => s.clearPacketLogs);

  const [packetFilter, setPacketFilter] = useState<string>("all");
  const [packetSearch, setPacketSearch] = useState<string>("");
  const [expandedPacketIndex, setExpandedPacketIndex] = useState<number | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const filteredPackets = packetLogs.filter((p) => {
    const pType = (p as { type?: string }).type;
    const matchesType = packetFilter === "all" || pType === packetFilter;
    const matchesSearch = !packetSearch || JSON.stringify(p).toLowerCase().includes(packetSearch.toLowerCase());
    return matchesType && matchesSearch;
  });

  const packetTypesList = ["all", ...Object.values(PACKET_TYPES)];

  const handleExportLogs = () => {
    downloadJson(`echo-telemetry-packets-${Date.now()}.json`, packetLogs);
  };

  return (
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
            type="button"
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
              type="button"
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
            const badgeStyle =
              typeBadgeColors[pktType] ||
              "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700";
            const dateStr = new Date(pkt.timestamp).toLocaleTimeString();

            return (
              <div
                key={`${pkt.missionId || "m"}-${pkt.step || 0}-${pkt.seq || idx}-${pkt.type}-${pkt.timestamp}`}
                className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/40 overflow-hidden transition-all hover:border-zinc-300 dark:hover:border-zinc-700/80"
              >
                <button
                  type="button"
                  onClick={() => setExpandedPacketIndex(isExpanded ? null : idx)}
                  className="w-full text-left flex items-center justify-between p-2.5 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
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
                </button>

                {isExpanded && (
                  <div className="p-3 bg-zinc-900 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800/80 text-zinc-200 dark:text-zinc-300 overflow-x-auto text-[10px] leading-relaxed relative group">
                    <CopyButton
                      text={JSON.stringify(pkt, null, 2)}
                      label="Copy Packet"
                      className="absolute top-2 right-2 px-2 py-1 bg-zinc-800 dark:bg-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-800 border border-zinc-700 rounded text-[9px] text-zinc-200"
                    />
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
            type="button"
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
          type="button"
          onClick={handleExportLogs}
          className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all flex items-center gap-1.5 text-xs font-semibold shadow-sm cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          <span>Export Telemetry JSON</span>
        </button>
      </div>
    </div>
  );
}
