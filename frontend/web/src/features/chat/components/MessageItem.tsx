"use client";

import React, { memo, useState } from "react";
import {
  Bot,
  User,
  Lightbulb,
  ChevronDown,
  Search,
  CheckCircle2,
  ListTodo,
  FileText,
  Terminal,
  AlertTriangle,
  Cpu,
  SkipForward,
  Copy,
  Check,
  Sparkles,
  Loader2,
} from "lucide-react";

import { cn } from "@/utils/cn";
import { Markdown } from "@/components/Markdown";
import { Message, ThoughtStep } from "../types";
import { CHAT_ROLES, PACKET_TYPES } from "../constants";

interface MessageItemProps {
  msg: Message;
  isLast: boolean;
  isLoading: boolean;
}

export const MessageItem = memo(function MessageItem({
  msg,
  isLast,
  isLoading,
}: MessageItemProps) {
  const isAssistant = msg.role === CHAT_ROLES.ASSISTANT;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!msg.content) return;
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "flex gap-3 md:gap-4 group animate-in py-2 max-w-5xl mx-auto w-full",
        !isAssistant ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar Icon */}
      <div
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm text-white",
          !isAssistant
            ? "bg-zinc-800 dark:bg-zinc-700"
            : "bg-gradient-to-tr from-purple-600 to-indigo-600 shadow-purple-500/20"
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
          "max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed flex flex-col gap-3 relative transition-all shadow-sm",
          !isAssistant
            ? "bg-purple-600 text-white rounded-tr-xs"
            : "bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 text-zinc-900 dark:text-zinc-100 rounded-tl-xs backdrop-blur-sm"
        )}
      >
        {/* Mission metadata bar */}
        {isAssistant && msg.meta && (
          <div className="flex flex-wrap items-center gap-2 pb-2 mb-1 border-b border-zinc-200/60 dark:border-zinc-800/60">
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                msg.meta.strategy === "react"
                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                  : "bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              )}
            >
              {msg.meta.strategy === "react" ? "⚡ Agent Mode" : "💬 Standard"}
            </span>

            {msg.usage && (
              <span className="text-[10px] font-mono text-zinc-400 ml-auto">
                {msg.usage.totalTokens} tokens
              </span>
            )}
          </div>
        )}

        {/* Thought Process Accordion */}
        {msg.steps.length > 0 && (
          <details className="group/thinking mb-1" open={isLoading && isLast}>
            <summary className="flex items-center gap-2 text-[10px] font-bold text-purple-600 dark:text-purple-400 cursor-pointer list-none hover:opacity-80 transition-opacity uppercase tracking-widest bg-purple-500/5 p-2 rounded-xl border border-purple-500/10">
              <Lightbulb className="h-3 w-3 text-amber-500" aria-hidden="true" />
              <span>Thought Process ({msg.steps.length} steps)</span>
              <ChevronDown className="h-3 w-3 ml-auto group-open/thinking:rotate-180 transition-transform" />
            </summary>
            <div className="mt-2.5 flex flex-col gap-2">
              {msg.steps.map((step, idx) => (
                <ThoughtStepView key={idx} step={step} />
              ))}
            </div>
          </details>
        )}

        {/* Content Body */}
        {msg.content ? (
          <Markdown content={msg.content} />
        ) : isLoading && isLast && msg.steps.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-zinc-400 text-xs italic">
            <span className="w-2 h-2 bg-purple-500 rounded-full animate-ping" />
            <span>Thinking...</span>
          </div>
        ) : null}

        {/* Streaming/interrupted status indicator */}
        {isAssistant && msg.status === 'streaming' && (
          <div className="flex items-center gap-1.5 py-1 text-[10px] text-amber-500 italic">
            <Loader2 className="h-3 w-3 animate-spin" />
            Receiving...
          </div>
        )}
        {isAssistant && msg.status === 'interrupted' && (
          <div className="flex items-center gap-1.5 py-1 text-[10px] text-zinc-400 italic border-t border-dashed border-zinc-300 dark:border-zinc-700 mt-1">
            <AlertTriangle className="h-3 w-3" />
            Response was interrupted — send a reply to continue
          </div>
        )}

        {/* Floating Action Toolbar on Assistant Messages */}
        {isAssistant && msg.content && (
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-200/40 dark:border-zinc-800/40 text-zinc-400 text-xs">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-1 rounded hover:bg-zinc-200/40 dark:hover:bg-zinc-800 cursor-pointer"
              title="Copy markdown text"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-[10px] text-emerald-500 font-semibold">Copied</span>
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

function ThoughtStepView({ step }: { step: ThoughtStep }) {
  if (step.type === PACKET_TYPES.REASONING) {
    return (
      <div className="text-xs text-zinc-600 dark:text-zinc-400 border-l-2 border-purple-500/30 pl-3 py-1 bg-zinc-50 dark:bg-zinc-950/40 rounded-r-lg">
        <Markdown content={step.content || ""} className="prose-xs" />
      </div>
    );
  }

  if (step.type === PACKET_TYPES.TOOL_CALL) {
    return (
      <div className="flex flex-col gap-1 rounded-xl bg-purple-500/5 border border-purple-500/10 px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
          <Search className="h-3 w-3" />
          <span>Tool Action: {step.toolName}</span>
        </div>
        {step.toolInput && (
          <pre className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-all bg-zinc-900/80 text-zinc-200 p-2 rounded-lg">
            {JSON.stringify(step.toolInput, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (step.type === PACKET_TYPES.TOOL_RESULT) {
    return (
      <div className="flex flex-col gap-1 rounded-xl bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
          <CheckCircle2 className="h-3 w-3" />
          <span>Observation: {step.toolName}</span>
        </div>
        <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed max-h-32 overflow-y-auto">
          {step.content}
        </p>
      </div>
    );
  }

  if (step.type === PACKET_TYPES.TODO && step.todos) {
    const todosList = Array.isArray(step.todos)
      ? step.todos
      : typeof step.todos === "object" && step.todos !== null
      ? [step.todos]
      : [];

    if (todosList.length === 0) return null;

    return (
      <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 px-3.5 py-3">
        <div className="flex items-center gap-2 text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <ListTodo className="h-3.5 w-3.5" />
          <span>Active Mission Plan</span>
        </div>
        <div className="flex flex-col gap-2 mt-1">
          {todosList.map((todo) => {
            const isDone = todo.status === "done";
            const isProgress = todo.status === "in_progress";
            const isFailed = todo.status === "failed";

            return (
              <div
                key={todo.id || todo.description}
                className="flex items-start gap-2.5 text-xs text-zinc-800 dark:text-zinc-200"
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                    isDone
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-500"
                      : isProgress
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-500 animate-pulse"
                      : isFailed
                      ? "bg-red-500/20 border-red-500/50 text-red-500"
                      : "border-zinc-400 text-transparent"
                  )}
                >
                  {isDone && <span className="text-[10px]">✓</span>}
                  {isProgress && <span className="text-[10px] animate-spin">⚡</span>}
                  {isFailed && <span className="text-[10px]">!</span>}
                </div>
                <span
                  className={cn(
                    "font-semibold truncate",
                    isDone && "line-through text-zinc-400"
                  )}
                >
                  {todo.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (
    (step.type === PACKET_TYPES.SUBAGENT_CALL ||
      step.type === PACKET_TYPES.SUBAGENT_RESULT) &&
    step.subagent
  ) {
    const s = step.subagent;
    const isCalling = s.status === "calling";
    const isFailed = s.status === "failed";

    return (
      <div
        className={cn(
          "flex flex-col gap-2 rounded-xl border px-3.5 py-3 transition-all",
          isCalling
            ? "bg-purple-500/5 border-purple-500/20"
            : isFailed
            ? "bg-red-500/5 border-red-500/20"
            : "bg-emerald-500/5 border-emerald-500/20"
        )}
      >
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <Terminal className="h-3.5 w-3.5 text-purple-500" />
          <span>Sub-Agent Delegation: {s.name}</span>
          <span className="ml-auto text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase bg-purple-500/10 text-purple-500">
            {s.status}
          </span>
        </div>
        <p className="text-xs text-zinc-700 dark:text-zinc-300 italic bg-zinc-100 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
          {s.instruction}
        </p>
        {s.result && (
          <div className="bg-zinc-950 text-zinc-200 p-2.5 rounded-lg text-xs font-mono max-h-36 overflow-y-auto">
            <Markdown content={s.result} />
          </div>
        )}
      </div>
    );
  }

  return null;
}
