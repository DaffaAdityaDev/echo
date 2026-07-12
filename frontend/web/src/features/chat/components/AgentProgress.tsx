"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, RefreshCw, Loader } from "lucide-react";

import { AgentProgress as AgentProgressType, AgentState } from "../types";
import { cn } from "@/utils/cn";
import { AgentStatusBadge } from "./AgentStatusBadge";

interface AgentProgressProps {
  progress: AgentProgressType | null;
  state?: AgentState;
}

export function AgentProgress({ progress, state }: AgentProgressProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!progress) return null;

  const { iteration, totalIterations, currentTool, swarm } = progress;

  // Swarm calculations
  const scrapedCount = swarm?.scrapedCount ?? 0;
  const failedCount = swarm?.failedCount ?? 0;
  const factsCount = swarm?.factsCount ?? 0;
  const discoveredCount = swarm?.discoveredCount ?? 0;
  const activeUrls = swarm?.activeUrls ? Object.values(swarm.activeUrls) : [];

  // Determine progress bar percentage
  let percentage = totalIterations > 0 ? Math.min((iteration / totalIterations) * 100, 100) : 0;
  if (totalIterations > 0 && swarm && discoveredCount > 0) {
    const totalProcessed = scrapedCount + failedCount;
    const swarmPercentage = Math.min((totalProcessed / Math.max(discoveredCount, 1)) * 100, 100);
    percentage = ((iteration - 0.5) / totalIterations) * 100 + (swarmPercentage * 0.5) / totalIterations;
  }

  // Get status message
  let statusMessage = progress.statusMessage || "Orchestrating mission...";
  if (currentTool) {
    statusMessage = `Executing ${currentTool}...`;
  }
  if (swarm?.status && swarm?.url) {
    const formattedUrl = swarm.url.replace(/^https?:\/\/(www\.)?/, "");
    const shortUrl = formattedUrl.length > 30 ? formattedUrl.substring(0, 30) + "..." : formattedUrl;
    if (swarm.status === "crawling") {
      statusMessage = `🌐 Crawling ${shortUrl}...`;
    } else if (swarm.status === "scraped") {
      statusMessage = `📄 Scraped ${shortUrl}`;
    } else if (swarm.status === "critic_validating") {
      statusMessage = `🧠 Validating facts from ${shortUrl}`;
    } else if (swarm.status === "critic_passed") {
      statusMessage = `✅ Critic approved facts from ${shortUrl}`;
    } else if (swarm.status === "critic_failed") {
      statusMessage = `🔄 Critic retrying extraction for ${shortUrl}`;
    } else if (swarm.status === "scrape_failed") {
      statusMessage = `❌ Failed to scrape ${shortUrl}`;
    } else if (swarm.status === "synthesis") {
      statusMessage = `📚 Synthesizing research findings...`;
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-3">
      <div className="glass border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col gap-3 relative overflow-hidden transition-all duration-300">
        {/* Background Glow */}
        <div className="absolute inset-0 bg-accent/5 blur-xl -z-10 rounded-2xl" />

        {/* Progress Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Loader size={16} className="text-accent animate-spin shrink-0" />
            <span className="text-xs font-semibold text-white/95 truncate">
              {statusMessage}
            </span>
            {(progress.agentStatus || state) && (
              <AgentStatusBadge state={state || progress.agentStatus?.state} className="shrink-0" />
            )}
          </div>
          {swarm && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-white/40 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/5 shrink-0"
              aria-label={isOpen ? "Collapse details" : "Expand details"}
            >
              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>

        {/* Progress Bar Container */}
        <div className="space-y-1.5">
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
            <div
              className="bg-accent h-full border-glow-accent rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
          
          {/* Sub-status Stats */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[11px] text-white/40">
            <div>
              Iteration <span className="font-bold text-white/70">{iteration}</span>{totalIterations > 0 ? `/${totalIterations}` : ""}
              {swarm && (
                <>
                  <span className="mx-2 text-white/10">|</span>
                  🕸️ <span className="font-bold text-white/70">{discoveredCount}</span> URLs found
                </>
              )}
            </div>
            
            {swarm && (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="text-success">✅</span>
                  <span className="font-bold text-white/70">{scrapedCount}</span> scraped
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-error">❌</span>
                  <span className="font-bold text-white/70">{failedCount}</span> failed
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-warning">📄</span>
                  <span className="font-bold text-white/70">{factsCount}</span> facts
                </span>
              </div>
            )}
          </div>
        </div>

        {/* URL Detail Collapse Section */}
        {swarm && activeUrls.length > 0 && (
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
          >
            <div className="border-t border-white/5 pt-3 mt-1 space-y-2">
              <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">
                URL Details
              </div>
              
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1.5 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {activeUrls.map((item) => {
                  const displayUrl = item.url.replace(/^https?:\/\/(www\.)?/, "");
                  
                  let statusIcon = <Loader size={12} className="text-accent animate-spin shrink-0 mt-0.5" />;
                  let statusLabel = "crawling";
                  let colorClass = "text-white/60";
                  
                  if (item.status === "critic_passed") {
                    statusIcon = <CheckCircle2 size={12} className="text-success shrink-0 mt-0.5" />;
                    statusLabel = `${item.dataSize ? Math.ceil(item.dataSize / 1000) + "k" : ""} chars, ${item.factsCount || 0} facts`;
                    colorClass = "text-success/90";
                  } else if (item.status === "scrape_failed") {
                    statusIcon = <XCircle size={12} className="text-error shrink-0 mt-0.5" />;
                    statusLabel = item.feedback || "scrape timeout";
                    colorClass = "text-error/90";
                  } else if (item.status === "critic_failed") {
                    statusIcon = <RefreshCw size={12} className="text-warning animate-spin-slow shrink-0 mt-0.5" />;
                    statusLabel = `critic retry (${item.attempt || 1}/3)`;
                    colorClass = "text-warning/90";
                  } else if (item.status === "critic_validating") {
                    statusIcon = <Loader size={12} className="text-accent animate-spin shrink-0 mt-0.5" />;
                    statusLabel = `critic validating`;
                    colorClass = "text-accent/90";
                  } else if (item.status === "scraped") {
                    statusIcon = <Loader size={12} className="text-accent animate-spin shrink-0 mt-0.5" />;
                    statusLabel = `scraped, extracting`;
                    colorClass = "text-white/80";
                  }

                  return (
                    <div key={item.url} className="flex items-start justify-between gap-3 text-xs bg-white/[0.02] border border-white/5 px-2.5 py-1.5 rounded-lg">
                      <span className="truncate text-white/70 font-mono text-[11px]" title={item.url}>
                        {displayUrl}
                      </span>
                      <div className={cn("flex items-center gap-1.5 text-[10px] shrink-0 font-medium", colorClass)}>
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
