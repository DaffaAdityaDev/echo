"use client";

import { CheckCircle2, ChevronDown, ChevronUp, Globe, Loader2, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/utils/cn";
import { buildAgentStatusMessage, formatAgentUrl } from "../protocol";
import type { AgentProgress as AgentProgressType, AgentState } from "../types";
import { AgentStatusBadge } from "./AgentStatusBadge";

interface AgentProgressProps {
  progress: AgentProgressType | null;
  state?: AgentState;
}

export function AgentProgress({ progress, state }: AgentProgressProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!progress) return null;

  const { currentTool, swarm } = progress;

  // Swarm calculations
  const scrapedCount = swarm?.scrapedCount ?? 0;
  const failedCount = swarm?.failedCount ?? 0;
  const factsCount = swarm?.factsCount ?? 0;
  const discoveredCount = swarm?.discoveredCount ?? 0;
  const activeUrls = swarm?.activeUrls ? Object.values(swarm.activeUrls) : [];

  const statusMessage = buildAgentStatusMessage(progress);

  return (
    <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 py-2 font-sans animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="rounded-md border border-accent/30 bg-gradient-to-r from-accent-soft to-elevated p-3 sm:p-4 shadow-lg flex flex-col gap-3 relative overflow-hidden transition-all duration-300">
        {/* Progress Header */}
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative flex items-center justify-center p-2 rounded-sm bg-accent-soft text-accent border border-accent/30 shrink-0">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span role="status" className="text-xs font-bold text-foreground truncate tracking-wide">
                  <SmoothTextReveal text={statusMessage} />
                </span>
                {(progress.agentStatus || state) && (
                  <AgentStatusBadge state={state || progress.agentStatus?.state} className="shrink-0 shadow-xs" />
                )}
              </div>

              {/* Active Tool Badge */}
              {currentTool && (
                <div
                  key={currentTool}
                  className="flex items-center gap-2 mt-1 animate-in fade-in slide-in-from-left-2 duration-300"
                >
                  <span className="px-2 py-0.5 rounded-sm text-2xs font-mono font-bold bg-accent-soft text-accent border border-accent/30 truncate max-w-full">
                    Tool: {currentTool}
                  </span>
                </div>
              )}
            </div>
          </div>

          {swarm && (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="text-muted hover:text-foreground transition-colors p-1.5 rounded-sm hover:bg-surface-hover shrink-0 cursor-pointer"
              aria-expanded={isOpen}
              aria-label={isOpen ? "Collapse details" : "Expand details"}
            >
              {isOpen ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {/* Sub-status Stats */}
        {swarm && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted pt-1 border-t border-border relative z-10 font-mono">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span>
                <strong className="text-foreground font-bold">{discoveredCount}</strong> URLs Discovered
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                <strong className="text-success">{scrapedCount}</strong> scraped
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                <strong className="text-danger">{failedCount}</strong> failed
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                <strong className="text-warning">{factsCount}</strong> facts
              </span>
            </div>
          </div>
        )}

        {/* URL Detail Collapse Section */}
        {swarm && activeUrls.length > 0 && (
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out relative z-10",
              isOpen ? "max-h-[1000px] opacity-100 mt-1" : "max-h-0 opacity-0",
            )}
          >
            <div className="border-t border-border pt-3 space-y-2">
              <div className="text-2xs font-bold uppercase tracking-wider text-muted">Live Swarm Crawler Activity</div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
                {activeUrls.map((item) => {
                  const displayUrl = formatAgentUrl(item.url);

                  let statusIcon = <Loader2 className="h-3 w-3 text-accent animate-spin shrink-0" aria-hidden="true" />;
                  let statusLabel = "crawling";
                  let colorClass = "text-accent";

                  if (item.status === "critic_passed") {
                    statusIcon = <CheckCircle2 className="h-3 w-3 text-success shrink-0" aria-hidden="true" />;
                    statusLabel = `${item.dataSize ? `${Math.ceil(item.dataSize / 1000)}k` : ""} chars, ${item.factsCount || 0} facts`;
                    colorClass = "text-success font-bold";
                  } else if (item.status === "scrape_failed") {
                    statusIcon = <XCircle className="h-3 w-3 text-danger shrink-0" aria-hidden="true" />;
                    statusLabel = item.feedback || "scrape failed";
                    colorClass = "text-danger font-bold";
                  } else if (item.status === "critic_failed") {
                    statusIcon = (
                      <RefreshCw className="h-3 w-3 text-warning animate-spin shrink-0" aria-hidden="true" />
                    );
                    statusLabel = `retry (${item.attempt || 1}/3)`;
                    colorClass = "text-warning font-bold";
                  } else if (item.status === "critic_validating") {
                    statusIcon = <Loader2 className="h-3 w-3 text-accent animate-spin shrink-0" aria-hidden="true" />;
                    statusLabel = `validating facts`;
                    colorClass = "text-accent";
                  } else if (item.status === "scraped") {
                    statusIcon = <Loader2 className="h-3 w-3 text-accent animate-spin shrink-0" aria-hidden="true" />;
                    statusLabel = `extracting facts`;
                    colorClass = "text-accent";
                  }

                  return (
                    <div
                      key={item.url}
                      className="flex items-center justify-between gap-3 bg-elevated border border-border px-3 py-1.5 rounded-sm"
                    >
                      <span className="truncate text-foreground text-xs" title={item.url}>
                        {displayUrl}
                      </span>
                      <div className={cn("flex items-center gap-1.5 text-2xs shrink-0", colorClass)}>
                        {statusIcon}
                        <span>{statusLabel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SmoothTextReveal({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");

  return (
    <span className={cn("inline-flex flex-wrap gap-x-1.5 items-center", className)}>
      {words.map((word, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: composite word-index key keeps words stable
          key={`word-${index}-${word}`}
          className="inline-block animate-in fade-in slide-in-from-bottom-1 fill-mode-forwards duration-200"
          style={{ animationDelay: `${Math.min(index * 25, 150)}ms` }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
