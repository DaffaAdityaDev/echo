"use client";

import { ChevronDown, ChevronRight, Download, Search, Terminal, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { cn } from "@/utils/cn";
import { downloadJson } from "@/utils/download";
import { PACKET_TYPES } from "../../constants";
import { useChatStore } from "../../stores/chatStore";

const TYPE_BADGE_COLORS = {
  metadata: "bg-danger/10 text-danger border-danger/20",
  reasoning: "bg-success/10 text-success border-success/20",
  content: "bg-accent/10 text-accent border-accent/20",
  tool_call: "bg-accent/10 text-accent border-accent/20",
  tool_result: "bg-warning/10 text-warning border-warning/20",
  debug: "bg-accent/10 text-accent border-accent/20",
  usage: "bg-success/10 text-success border-success/20",
  swarm_status: "bg-warning/10 text-warning border-warning/20",
  error: "bg-danger/20 text-danger border-danger/30 font-bold",
} as const;

function getTypeBadgeColor(type: string): string {
  if (type in TYPE_BADGE_COLORS) {
    // SAFETY: Verified type key exists in TYPE_BADGE_COLORS constant map
    return TYPE_BADGE_COLORS[type as keyof typeof TYPE_BADGE_COLORS];
  }

  return "bg-surface-hover text-foreground border-border-strong";
}

export function PacketLogsPanel() {
  const packetLogs = useChatStore((s) => s.packetLogs);
  const maxPacketLogSize = useChatStore((s) => s.maxPacketLogSize);
  const clearPacketLogs = useChatStore((s) => s.clearPacketLogs);

  const [packetFilter, setPacketFilter] = useState<string>("all");
  const [packetSearch, setPacketSearch] = useState<string>("");
  const [expandedPacketIndex, setExpandedPacketIndex] = useState<number | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const filteredPackets = packetLogs.filter((p) => {
    const matchesType = packetFilter === "all" || p.type === packetFilter;
    const matchesSearch = !packetSearch || JSON.stringify(p).toLowerCase().includes(packetSearch.toLowerCase());

    return matchesType && matchesSearch;
  });

  const packetTypesList = ["all", ...Object.values(PACKET_TYPES)];

  const handleExportLogs = () => {
    downloadJson(`echo-telemetry-packets-${Date.now()}.json`, packetLogs);
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Filter packets"
              placeholder="Filter packets by JSON text..."
              value={packetSearch}
              onChange={(e) => setPacketSearch(e.target.value)}
              className="w-full bg-surface-hover border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => setPacketSearch("")}
            className="px-2.5 py-1.5 rounded-sm border border-border bg-surface-hover text-xs text-muted hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
          >
            Clear Search
          </button>
        </div>

        <div role="group" aria-label="Filter by packet type" className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {packetTypesList.map((ptype) => (
            <button
              key={ptype}
              type="button"
              onClick={() => setPacketFilter(ptype)}
              aria-pressed={packetFilter === ptype}
              className={cn(
                "px-2.5 py-1 rounded-sm text-2xs font-bold uppercase transition-all border cursor-pointer whitespace-nowrap",
                packetFilter === ptype
                  ? "bg-accent/15 text-accent border-accent/40"
                  : "bg-surface-hover text-muted border-border hover:bg-border hover:text-foreground",
              )}
            >
              {ptype}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs min-h-0">
        {filteredPackets.length === 0 ? (
          <div role="status" className="text-center py-20 text-xs text-muted space-y-2">
            <Terminal className="h-8 w-8 mx-auto text-muted" aria-hidden="true" />
            <p>No SSE telemetry packets captured matching filters.</p>
          </div>
        ) : (
          filteredPackets.map((pkt, idx) => {
            const isExpanded = expandedPacketIndex === idx;
            const pktType = pkt.type || "packet";
            const badgeStyle = getTypeBadgeColor(pktType);
            const dateStr = new Date(pkt.timestamp).toLocaleTimeString();

            return (
              <div
                key={`${pkt.missionId || "m"}-${pkt.step || 0}-${pkt.seq || idx}-${pkt.type}-${pkt.timestamp}`}
                className="rounded-md border border-border bg-surface overflow-hidden transition-all hover:border-border-strong"
              >
                <button
                  type="button"
                  onClick={() => setExpandedPacketIndex(isExpanded ? null : idx)}
                  aria-expanded={isExpanded}
                  className="w-full text-left flex items-center justify-between p-2.5 cursor-pointer hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted shrink-0" aria-hidden="true" />
                    )}
                    <span className={cn("px-2 py-0.5 rounded-sm text-2xs font-extrabold uppercase border", badgeStyle)}>
                      {pktType}
                    </span>
                    <span className="text-xs text-muted truncate">{JSON.stringify(pkt).slice(0, 70)}...</span>
                  </div>
                  <span className="text-2xs text-muted font-mono shrink-0 ml-2">{dateStr}</span>
                </button>

                {isExpanded && (
                  <div className="p-3 bg-code border-t border-code-border text-code-foreground overflow-x-auto text-xs leading-relaxed relative group">
                    <CopyButton
                      text={JSON.stringify(pkt, null, 2)}
                      label="Copy Packet"
                      className="absolute top-2 right-2 px-2 py-1 bg-code-header hover:bg-code-border border border-code-border rounded-sm text-2xs text-code-foreground"
                    />
                    <pre className="font-mono text-code-foreground">{JSON.stringify(pkt, null, 2)}</pre>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>

      <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={clearPacketLogs}
            className="px-2.5 py-1 rounded-sm text-muted hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Clear Feed</span>
          </button>
          <span className="text-muted text-2xs font-mono">
            Buffer: {packetLogs.length} / {maxPacketLogSize} events
          </span>
        </div>

        <button
          type="button"
          onClick={handleExportLogs}
          className="px-3 py-1.5 rounded-sm bg-surface-hover border border-border-strong text-foreground hover:bg-border transition-all flex items-center gap-1.5 text-xs font-semibold shadow-sm cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          <span>Export Telemetry JSON</span>
        </button>
      </div>
    </div>
  );
}
