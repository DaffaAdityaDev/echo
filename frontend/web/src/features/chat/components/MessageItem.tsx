"use client";

import { AlertTriangle, Check, ChevronDown, Copy, Lightbulb, Loader2, Sparkles, Terminal, User } from "lucide-react";
import dynamic from "next/dynamic";
import { memo, useDeferredValue, useState } from "react";
import { cn } from "@/utils/cn";
import { CHAT_ROLES } from "../constants";
import type { Message } from "../types";
import { ThoughtStepView } from "./steps";

const Markdown = dynamic(() => import("@/components/Markdown"), {
  ssr: false,
  loading: () => <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />,
});

const LARGE_MESSAGE_THRESHOLD = 50_000;

const PROTOCOL_MARKUP =
  /<(dsml|tool_calls|invoke|parameter|write_todos|delegate_task|user_objective|function)(\s[^>]*)?>[\s\S]*?<\/\1>|<\/?(dsml|tool_calls|invoke|parameter|write_todos|delegate_task|user_objective|function)\b[^>]*>/gi;

function stripProtocolMarkup(content: string): string {
  return content.replace(PROTOCOL_MARKUP, "");
}

function formatContentSize(length: number): string {
  if (length >= 1_000_000) return `${(length / 1_000_000).toFixed(1)} MB`;
  if (length >= 1_000) return `${Math.round(length / 1_000)} KB`;
  return `${length} chars`;
}

interface MessageItemProps {
  msg: Message;
  isLast: boolean;
  isLoading: boolean;
}

export const MessageItem = memo(function MessageItem({ msg, isLast, isLoading }: MessageItemProps) {
  const isAssistant = msg.role === CHAT_ROLES.ASSISTANT;
  const isStreaming = isAssistant && (msg.status === "streaming" || (isLast && isLoading));
  const deferredContent = useDeferredValue(msg.content);
  const activeContent = isStreaming ? deferredContent : msg.content;

  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [renderAsMarkdown, setRenderAsMarkdown] = useState(false);

  const isLarge = activeContent.length > LARGE_MESSAGE_THRESHOLD;
  const showPreview = isLarge && !expanded;

  const handleCopy = () => {
    if (!msg.content) return;
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = () => {
    if (!activeContent) {
      if (isLoading && isLast && msg.steps.length === 0) {
        return (
          <div className="flex items-center gap-2 py-2 text-muted text-xs italic font-mono">
            <span className="w-2 h-2 bg-gb-blue rounded-full animate-ping" />
            <span>Thinking...</span>
          </div>
        );
      }
      return null;
    }

    if (showPreview) {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-xs">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              Large message: {formatContentSize(activeContent.length)} (~{Math.round(activeContent.length / 4 / 1000)}k
              tokens) — preview shown
            </span>
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs max-h-64 overflow-y-auto bg-zinc-50 dark:bg-zinc-950/40 border border-border rounded-xs p-2">
            {stripProtocolMarkup(activeContent.slice(0, LARGE_MESSAGE_THRESHOLD))}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="px-2 py-1 rounded-xs text-[10px] font-bold uppercase tracking-wider border border-gb-bright-blue/30 bg-blue-50 dark:bg-blue-950/40 text-gb-blue hover:opacity-80 transition-opacity cursor-pointer"
            >
              Load full message
            </button>
            <button
              type="button"
              onClick={() => {
                setRenderAsMarkdown(true);
                setExpanded(true);
              }}
              className="px-2 py-1 rounded-xs text-[10px] font-bold uppercase tracking-wider border border-purple-500/30 bg-purple-50 dark:bg-purple-950/40 text-purple-600 hover:opacity-80 transition-opacity cursor-pointer"
            >
              Render as markdown (heavy)
            </button>
          </div>
        </div>
      );
    }

    if (renderAsMarkdown) {
      return <Markdown content={stripProtocolMarkup(activeContent)} isStreaming={isStreaming} />;
    }

    if (isLarge) {
      // Expanded plain-text view — full 1M-context payload without the
      // Markdown parse cost (opt-in markdown available via the button above).
      return (
        <pre className="whitespace-pre-wrap break-words font-mono text-xs w-full">
          {stripProtocolMarkup(activeContent)}
        </pre>
      );
    }

    return <Markdown content={stripProtocolMarkup(activeContent)} isStreaming={isStreaming} />;
  };

  return (
    <div
      className={cn(
        "flex gap-3 md:gap-4 group animate-in fade-in duration-300 py-2 max-w-5xl mx-auto w-full",
        !isAssistant ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar Icon */}
      <div
        className={cn(
          "w-8 h-8 rounded-xs flex items-center justify-center shrink-0 shadow-xs border font-mono font-bold text-xs transition-colors",
          !isAssistant
            ? "bg-foreground text-white border-foreground"
            : "bg-blue-50 text-gb-blue border-gb-bright-blue/30",
        )}
      >
        {!isAssistant ? (
          <User className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Sparkles className="h-4 w-4 text-gb-blue" aria-hidden="true" />
        )}
      </div>

      {/* Message Card Container */}
      <div
        className={cn(
          "max-w-[90%] sm:max-w-[85%] rounded-xs px-4 py-3 text-sm leading-relaxed flex flex-col gap-3 relative transition-all shadow-xs border font-mono",
          !isAssistant ? "bg-slate-50 text-foreground border-slate-300" : "bg-white border-border text-foreground",
        )}
      >
        {/* Mission metadata bar */}
        {isAssistant && msg.meta && (
          <div className="flex flex-wrap items-center gap-2 pb-2 mb-1 border-b border-zinc-200/80 dark:border-zinc-800">
            {msg.meta.strategy === "react" ? (
              <span className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-md font-bold text-[10px]">
                <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                <span>Agent Mode</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                <Terminal className="h-3 w-3 text-blue-500" />
                <span>Standard Mode</span>
              </span>
            )}

            {msg.usage && (
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 ml-auto">
                {msg.usage.totalTokens} tokens
              </span>
            )}
          </div>
        )}

        {/* Thought Process Accordion */}
        {msg.steps.length > 0 && (
          <details className="group/thinking mb-1" open={isLoading && isLast}>
            <summary className="flex items-center gap-2 text-[10px] font-bold text-gb-blue cursor-pointer list-none hover:opacity-80 transition-opacity uppercase tracking-widest bg-blue-50 p-2 rounded-xs border border-gb-bright-blue/30">
              <Lightbulb className="h-3 w-3 text-amber-500" aria-hidden="true" />
              <span>Thought Process ({msg.steps.length} steps)</span>
              <ChevronDown className="h-3 w-3 ml-auto group-open/thinking:rotate-180 transition-transform" />
            </summary>
            <div className="mt-2.5 flex flex-col gap-2">
              {msg.steps.map((step, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: thought steps have no stable id
                <ThoughtStepView key={idx} step={step} isStreaming={isStreaming && idx === msg.steps.length - 1} />
              ))}
            </div>
          </details>
        )}

        {/* Content Body */}
        {renderContent()}

        {/* Streaming/interrupted status indicator */}
        {isAssistant && msg.status === "streaming" && (
          <div className="flex items-center gap-1.5 py-1 text-[10px] text-amber-600 italic font-mono">
            <Loader2 className="h-3 w-3 animate-spin" />
            Receiving...
          </div>
        )}
        {isAssistant && msg.status === "interrupted" && (
          <div className="flex items-center gap-1.5 py-1 text-[10px] text-zinc-500 italic border-t border-dashed border-zinc-300 dark:border-zinc-700 mt-1 font-mono">
            <AlertTriangle className="h-3 w-3" />
            Response was interrupted — send a reply to continue
          </div>
        )}

        {/* Floating Action Toolbar on Assistant Messages */}
        {isAssistant && msg.content && (
          <div className="flex items-center gap-2 pt-2 border-t border-border text-muted text-xs font-mono">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded-xs hover:bg-surface-hover cursor-pointer"
              title="Copy markdown text"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success" />
                  <span className="text-[10px] text-success font-bold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="text-[10px]">Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
