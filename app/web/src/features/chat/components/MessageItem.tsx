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
  loading: () => <div className="h-4 w-48 bg-surface-hover rounded-sm animate-pulse" />,
});

const LARGE_MESSAGE_THRESHOLD = 50_000;

interface MessageItemProps {
  msg: Message;
  isStreaming: boolean;
  isLast: boolean;
}

export const MessageItem = memo(function MessageItem({ msg, isStreaming, isLast }: MessageItemProps) {
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
  const displaySteps = isContentFromReasoning ? msg.steps.filter((s) => s.type !== PACKET_TYPES.REASONING) : msg.steps;

  const thoughtOpen = isThoughtOpen ?? ((isStreaming && isLast) || !hasContent);

  const handleCopy = () => {
    const textToCopy =
      rawContent ||
      msg.steps
        ?.map((s) => s.content)
        .filter(Boolean)
        .join("\n\n");

    if (!textToCopy) return;
    copy(textToCopy);
  };

  const renderContent = () => {
    if (!activeContent) {
      if (isStreaming && isLast && displaySteps.length === 0) {
        return (
          <div role="status" className="flex items-center gap-2 py-2 text-muted text-xs italic font-mono">
            <span className="w-2 h-2 bg-accent rounded-full animate-ping" aria-hidden="true" />
            <span>Thinking...</span>
          </div>
        );
      }

      return null;
    }

    if (showPreview) {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-warning border border-warning/30 bg-warning/10 px-2 py-1 rounded-sm">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>
              Large message: {formatContentSize(activeContent.length)} (~{Math.round(activeContent.length / 4 / 1000)}k
              tokens) — preview shown
            </span>
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs max-h-64 overflow-y-auto bg-surface border border-border rounded-sm p-2">
            {stripProtocolMarkup(activeContent.slice(0, LARGE_MESSAGE_THRESHOLD))}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="px-2 py-1 rounded-sm text-2xs font-bold uppercase tracking-wider border border-accent/30 bg-accent-soft text-accent hover:bg-accent/15 transition-colors cursor-pointer"
            >
              Load full message
            </button>
            <button
              type="button"
              onClick={() => {
                setRenderAsMarkdown(true);
                setExpanded(true);
              }}
              className="px-2 py-1 rounded-sm text-2xs font-bold uppercase tracking-wider border border-border bg-surface text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
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
        "flex gap-2.5 sm:gap-3 md:gap-4 group animate-in fade-in duration-300 py-2 max-w-5xl mx-auto w-full",
        !isAssistant ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar Icon */}
      <div
        className={cn(
          "w-7 h-7 sm:w-8 sm:h-8 rounded-sm flex items-center justify-center shrink-0 shadow-xs border font-mono font-bold text-xs transition-colors",
          !isAssistant
            ? "bg-foreground text-background border-foreground"
            : "bg-accent-soft text-accent border-accent/30",
        )}
      >
        {!isAssistant ? (
          <User className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        )}
      </div>

      {/* Message Card Container */}
      <div
        className={cn(
          "rounded-md px-3 sm:px-4 py-3 text-sm leading-relaxed flex flex-col gap-3 relative transition-all shadow-xs border font-mono min-w-0 text-foreground",
          !isAssistant
            ? "bg-surface-hover border-border-strong max-w-[90%] sm:max-w-[85%]"
            : "bg-elevated border-border flex-1 w-full max-w-full",
        )}
      >
        {/* Mission metadata bar */}
        {isAssistant && msg.meta && (
          <div className="flex flex-wrap items-center gap-2 pb-2 mb-1 border-b border-border">
            {msg.meta.strategy === "react" ? (
              <span className="inline-flex items-center gap-1 text-accent bg-accent-soft border border-accent/30 px-2 py-0.5 rounded-sm font-bold text-2xs">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                <span>Agent Mode</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-foreground bg-surface-hover border border-border px-2 py-0.5 rounded-sm font-semibold text-2xs">
                <Terminal className="h-3 w-3 text-accent" aria-hidden="true" />
                <span>Standard Mode</span>
              </span>
            )}

            {msg.usage && <span className="text-2xs font-mono text-muted ml-auto">{msg.usage.totalTokens} tokens</span>}
          </div>
        )}

        {/* Thought Process Accordion */}
        {displaySteps.length > 0 && (
          <details
            className="group/thinking mb-1"
            open={thoughtOpen}
            onToggle={(e) => setIsThoughtOpen(e.currentTarget.open)}
          >
            <summary className="flex items-center gap-2 text-2xs font-bold text-accent cursor-pointer list-none hover:bg-accent/15 transition-colors uppercase tracking-widest bg-accent-soft p-2 rounded-sm border border-accent/30">
              <Lightbulb className="h-3 w-3 text-warning" aria-hidden="true" />
              <span>Thought Process ({displaySteps.length} steps)</span>
              <ChevronDown
                className="h-3 w-3 ml-auto group-open/thinking:rotate-180 transition-transform"
                aria-hidden="true"
              />
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
          <div className="flex items-center gap-1.5 py-1 text-2xs text-warning italic font-mono">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            Receiving...
          </div>
        )}
        {isAssistant && msg.status === "interrupted" && (
          <div className="flex items-center gap-1.5 py-1 text-xs text-muted italic border-t border-dashed border-border-strong mt-1 font-mono">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            Response was interrupted — send a reply to continue
          </div>
        )}
        {isAssistant && msg.status === "error" && (
          <div
            role="alert"
            className="flex items-center gap-1.5 py-1 text-xs text-danger italic border-t border-dashed border-danger/40 mt-1 font-mono"
          >
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            Response failed — check the provider and retry
          </div>
        )}

        {/* Floating Action Toolbar on Assistant Messages */}
        {isAssistant && (msg.content || msg.steps.length > 0) && (
          <div className="flex items-center gap-2 pt-2 border-t border-border text-muted text-xs font-mono">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded-sm hover:bg-surface-hover cursor-pointer"
              title="Copy markdown text"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  <span className="text-2xs text-success font-bold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-2xs">Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
