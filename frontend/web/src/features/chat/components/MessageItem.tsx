"use client";

import React, { memo } from "react";
import { Bot, User, Lightbulb, ChevronDown, Search, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";
import { Markdown } from "@/components/Markdown";
import { Message, ThoughtStep } from "../types";

import { CHAT_ROLES, PACKET_TYPES, CHAT_MESSAGES } from "../constants";

interface MessageItemProps {
  msg: Message;
  isLast: boolean;
  isLoading: boolean;
}

export const MessageItem = memo(function MessageItem({ msg, isLast, isLoading }: MessageItemProps) {
  const isAssistant = msg.role === CHAT_ROLES.ASSISTANT;


  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-4 group animate-in",
        !isAssistant ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
        !isAssistant ? "bg-white/10" : "bg-accent border-glow"
      )}>
        {!isAssistant ? <User size={16} aria-hidden="true" /> : <Bot size={16} aria-hidden="true" />}
      </div>
      
      <div className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed flex flex-col gap-3",
        !isAssistant 
          ? "bg-white/[0.03] text-white border border-white/5" 
          : "text-white/90"
      )}>
        {/* Mission metadata bar */}
        {isAssistant && msg.meta && (
          <div className="flex flex-wrap items-center gap-2 pb-2 mb-2 border-b border-white/5">
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
              msg.meta.strategy === 'react'
                ? "bg-accent/20 text-accent border border-accent/30"
                : "bg-white/5 text-white/40 border border-white/10"
            )}>
              {msg.meta.strategy === 'react' ? '⚡ Agent' : '💬 Chat'}
            </span>
            
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-tight">
              {msg.meta.historyDepth ?? 0} Depth
            </span>

            {msg.usage && (
              <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.02] border border-white/5">
                <span className="text-[10px] font-mono text-white/40 flex gap-2">
                  <span title="Total Tokens" className="text-accent/60">{msg.usage.totalTokens}</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Thought Process */}
        {msg.steps.length > 0 && (
          <details className="group/thinking mb-1" open>
            <summary className="flex items-center gap-2 text-[10px] font-bold text-muted cursor-pointer list-none hover:text-white/40 transition-colors uppercase tracking-widest">
              <Lightbulb size={11} className="text-warning/50" aria-hidden="true" />
              <span>Thought Process</span>
              <ChevronDown size={11} className="ml-auto group-open/thinking:rotate-180 transition-transform" aria-hidden="true" />
            </summary>
            <div className="mt-3 flex flex-col gap-2.5">
              {msg.steps.map((step, idx) => (
                <ThoughtStepView key={idx} step={step} />
              ))}
            </div>
          </details>
        )}

        {/* Content */}
        {msg.content ? (
          <Markdown content={msg.content} />
        ) : (isLoading && isLast && msg.steps.length === 0 ? (
          <div className="flex items-center gap-2 py-2" aria-live="polite">
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            <span className="text-white/20 text-xs italic tracking-wide">{CHAT_MESSAGES.ORCHESTRATING}</span>
          </div>
        ) : null)}
      </div>
    </motion.div>
  );
});

function ThoughtStepView({ step }: { step: ThoughtStep }) {
  if (step.type === PACKET_TYPES.REASONING) {
    return (
      <div className="text-[11px] text-white/30 border-l border-white/10 pl-3 py-0.5 leading-relaxed">
        <Markdown content={step.content || ""} className="prose-xs opacity-70" />
      </div>
    );
  }

  if (step.type === PACKET_TYPES.TOOL_CALL) {
    return (
      <div className="flex flex-col gap-1 rounded-lg bg-accent/5 border border-accent/10 px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] font-bold text-accent/60 uppercase tracking-wider">
          <Search size={10} aria-hidden="true" />
          <span>Action: {step.toolName}</span>
        </div>
        {step.toolInput && (
          <pre className="text-[9px] text-white/20 font-mono whitespace-pre-wrap break-all bg-black/20 p-1.5 rounded">
            {JSON.stringify(step.toolInput, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (step.type === PACKET_TYPES.TOOL_RESULT) {
    return (
      <div className="flex flex-col gap-1 rounded-lg bg-success/5 border border-success/10 px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] font-bold text-success/60 uppercase tracking-wider">
          <CheckCircle2 size={10} aria-hidden="true" />
          <span>Observation: {step.toolName}</span>
        </div>
        <p className="text-[10px] text-white/30 leading-relaxed max-h-32 overflow-y-auto scrollbar-hide">{step.content}</p>
      </div>
    );
  }

  return null;
}
