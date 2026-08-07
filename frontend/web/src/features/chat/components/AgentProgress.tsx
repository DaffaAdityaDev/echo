"use client";

import { CheckCircle2, ChevronDown, ChevronUp, Globe, Loader2, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/utils/cn";
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

  // Get status message
  let statusMessage = progress.statusMessage || "Agent Orchestrating Mission...";
  if (currentTool) {
    statusMessage = `Executing ${currentTool}...`;
  }
  if (swarm?.status && swarm?.url) {
    const formattedUrl = swarm.url.replace(/^https?:\/\/(www\.)?/, "");
    const shortUrl = formattedUrl.length > 32 ? `${formattedUrl.substring(0, 32)}...` : formattedUrl;
    if (swarm.status === "crawling") {
      statusMessage = `Crawling ${shortUrl}...`;
    } else if (swarm.status === "scraped") {
      statusMessage = `Scraped ${shortUrl}`;
    } else if (swarm.status === "critic_validating") {
      statusMessage = `Validating facts from ${shortUrl}`;
    } else if (swarm.status === "critic_passed") {
      statusMessage = `Approved facts from ${shortUrl}`;
    } else if (swarm.status === "critic_failed") {
      statusMessage = `Retrying extraction for ${shortUrl}`;
    } else if (swarm.status === "scrape_failed") {
      statusMessage = `Failed to scrape ${shortUrl}`;
    } else if (swarm.status === "synthesis") {
      statusMessage = `Synthesizing research findings...`;
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-2 font-sans animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="rounded-2xl border border-purple-500/30 dark:border-purple-500/20 bg-gradient-to-r from-purple-500/10 via-blue-500/5 to-zinc-50/80 dark:to-zinc-900/60 p-4 shadow-xl backdrop-blur-xl flex flex-col gap-3 relative overflow-hidden transition-all duration-300">
        {/* Animated Background Glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none animate-pulse" />

        {/* Progress Header */}
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="relative flex items-center justify-center p-2 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 shrink-0">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="absolute inset-0 rounded-xl bg-purple-500/20 animate-ping opacity-25" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 truncate tracking-wide">
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
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
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
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors p-1.5 rounded-xl hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 shrink-0 cursor-pointer"
              aria-label={isOpen ? "Collapse details" : "Expand details"}
            >
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Sub-status Stats */}
        {swarm && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] text-zinc-600 dark:text-zinc-300 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60 relative z-10 font-mono">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-blue-500" />
              <span>
                <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{discoveredCount}</strong> URLs
                Discovered
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <strong className="text-emerald-600 dark:text-emerald-400">{scrapedCount}</strong> scraped
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                <strong className="text-rose-600 dark:text-rose-400">{failedCount}</strong> failed
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <strong className="text-amber-600 dark:text-amber-400">{factsCount}</strong> facts
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
            <div className="border-t border-zinc-200/80 dark:border-zinc-800/80 pt-3 space-y-2">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Live Swarm Crawler Activity
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                {activeUrls.map((item) => {
                  const displayUrl = item.url.replace(/^https?:\/\/(www\.)?/, "");

                  let statusIcon = <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />;
                  let statusLabel = "crawling";
                  let colorClass = "text-blue-600 dark:text-blue-400";

                  if (item.status === "critic_passed") {
                    statusIcon = <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />;
                    statusLabel = `${item.dataSize ? `${Math.ceil(item.dataSize / 1000)}k` : ""} chars, ${item.factsCount || 0} facts`;
                    colorClass = "text-emerald-600 dark:text-emerald-400 font-bold";
                  } else if (item.status === "scrape_failed") {
                    statusIcon = <XCircle className="h-3 w-3 text-rose-500 shrink-0" />;
                    statusLabel = item.feedback || "scrape failed";
                    colorClass = "text-rose-600 dark:text-rose-400 font-bold";
                  } else if (item.status === "critic_failed") {
                    statusIcon = <RefreshCw className="h-3 w-3 text-amber-500 animate-spin shrink-0" />;
                    statusLabel = `retry (${item.attempt || 1}/3)`;
                    colorClass = "text-amber-600 dark:text-amber-400 font-bold";
                  } else if (item.status === "critic_validating") {
                    statusIcon = <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />;
                    statusLabel = `validating facts`;
                    colorClass = "text-blue-600 dark:text-blue-400";
                  } else if (item.status === "scraped") {
                    statusIcon = <Loader2 className="h-3 w-3 text-purple-500 animate-spin shrink-0" />;
                    statusLabel = `extracting facts`;
                    colorClass = "text-purple-600 dark:text-purple-400";
                  }

                  return (
                    <div
                      key={item.url}
                      className="flex items-center justify-between gap-3 bg-white/80 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-2xs"
                    >
                      <span className="truncate text-zinc-800 dark:text-zinc-200 text-[11px]" title={item.url}>
                        {displayUrl}
                      </span>
                      <div className={cn("flex items-center gap-1.5 text-[10px] shrink-0", colorClass)}>
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
    <span key={text} className={cn("inline-flex flex-wrap gap-x-1 items-center", className)}>
      {words.map((word, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: composite word-index key keeps duplicates stable in streaming reveal
          key={`${word}-${index}`}
          className="inline-block animate-in fade-in slide-in-from-bottom-1 fill-mode-forwards duration-200"
          style={{ animationDelay: `${index * 30}ms` }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
