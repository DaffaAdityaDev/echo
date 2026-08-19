"use client";

import { AlertTriangle, Check, ChevronDown, Copy, Lightbulb, Loader2, Sparkles, Terminal, User } from "lucide-react";
import dynamic from "next/dynamic";
import { memo, useDeferredValue, useState } from "react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { cn } from "@/utils/cn";
import { formatContentSize } from "@/utils/format";
import { CHAT_ROLES, PACKET_TYPES } from "../constants";
import { stripProtocolMarkup } from "../protocol";
import type { Message } from "../types";
import { ThoughtStepView } from "./steps";

const Markdown = dynamic(() => import("@/components/Markdown"), {
  ssr: false,
  loading: () => <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />,
});

const LARGE_MESSAGE_THRESHOLD = 50_000;

interface MessageItemContext {
  isStreaming: boolean;
  isLast: boolean;
}

interface MessageItemProps {
  msg: Message;
  context: MessageItemContext;
}

export const MessageItem = memo(function MessageItem({ msg, context }: MessageItemProps) {
  const { isStreaming, isLast } = context;
  const isAssistant = msg.role === CHAT_ROLES.ASSISTANT;

  // Fallback to reasoning step content if main msg.content is empty (e.g. DeepSeek R1 streaming)
  const reasoningStep = msg.steps?.find((s) => s.type === PACKET_TYPES.REASONING);
  const isContentFromReasoning = !msg.content && !!reasoningStep?.content;
  const rawContent = msg.content || reasoningStep?.content || "";

  const deferredContent = useDeferredValue(rawContent);
  const activeContent = isStreaming ? deferredContent : rawContent;

  const [isThoughtOpen, setIsThoughtOpen] = useState<boolean | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const [renderAsMarkdown, setRenderAsMarkdown] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  const isLarge = activeContent.length > LARGE_MESSAGE_THRESHOLD;
  const showPreview = isLarge && !expanded;

  const hasContent = activeContent && activeContent.trim().length > 0;

  // Filter steps: if reasoning content was promoted to main body, don't duplicate it in accordion
  const displaySteps = isContentFromReasoning
    ? msg.steps.filter((s) => s.type !== PACKET_TYPES.REASONING)
    : msg.steps;

  const thoughtOpen = isThoughtOpen ?? ((isStreaming && isLast) || !hasContent);

  const handleCopy = () => {
    const textToCopy = rawContent || msg.steps?.map((s) => s.content).filter(Boolean).join("\n\n");
    if (!textToCopy) return;
    copy(textToCopy);
  };

  const renderContent = () => {
    if (!activeContent) {
      if (isStreaming && isLast && displaySteps.length === 0) {
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
          "rounded-xs px-4 py-3 text-sm leading-relaxed flex flex-col gap-3 relative transition-all shadow-xs border font-mono min-w-0",
          !isAssistant
            ? "bg-slate-50 text-foreground border-slate-300 max-w-[90%] sm:max-w-[85%]"
            : "bg-white border-border text-foreground flex-1 w-full max-w-full",
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
        {displaySteps.length > 0 && (
          <details
            className="group/thinking mb-1"
            open={thoughtOpen}
            onToggle={(e) => setIsThoughtOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="flex items-center gap-2 text-[10px] font-bold text-gb-blue cursor-pointer list-none hover:opacity-80 transition-opacity uppercase tracking-widest bg-blue-50 p-2 rounded-xs border border-gb-bright-blue/30">
              <Lightbulb className="h-3 w-3 text-amber-500" aria-hidden="true" />
              <span>Thought Process ({displaySteps.length} steps)</span>
              <ChevronDown className="h-3 w-3 ml-auto group-open/thinking:rotate-180 transition-transform" />
            </summary>
            <div className="mt-2.5 flex flex-col gap-2">
              {displaySteps.map((step, idx) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: thought steps have no stable id
                <ThoughtStepView key={idx} step={step} isStreaming={isStreaming && idx === displaySteps.length - 1} />
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
        {isAssistant && msg.status === "error" && (
          <div className="flex items-center gap-1.5 py-1 text-[10px] text-red-600 dark:text-red-400 italic border-t border-dashed border-red-300 dark:border-red-800 mt-1 font-mono">
            <AlertTriangle className="h-3 w-3" />
            Response failed — check the provider and retry
          </div>
        )}

        {/* Floating Action Toolbar on Assistant Messages */}
        {isAssistant && (msg.content || msg.steps.length > 0) && (
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
