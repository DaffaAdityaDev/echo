"use client";

import React, { memo } from "react";
import { Bot, User, Lightbulb, ChevronDown, Search, CheckCircle2, ListTodo, FileText, Terminal, AlertTriangle, Cpu } from "lucide-react";
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

  if (step.type === PACKET_TYPES.TODO && step.todos) {
    return (
      <div className="flex flex-col gap-2 rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase tracking-widest border-b border-white/5 pb-2">
          <ListTodo size={12} className="text-accent" />
          <span>📋 Active Mission Plan</span>
        </div>
        <div className="flex flex-col gap-2 mt-1.5">
          {step.todos.map((todo) => {
            const isDone = todo.status === 'done';
            const isProgress = todo.status === 'in_progress';
            const isFailed = todo.status === 'failed';

            return (
              <div key={todo.id} className="flex items-start gap-2.5 text-xs text-white/70">
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                  isDone ? "bg-success/20 border-success/50 text-success" :
                  isProgress ? "bg-accent/20 border-accent/50 text-accent animate-pulse" :
                  isFailed ? "bg-error/20 border-error/50 text-error" :
                  "border-white/20 text-transparent"
                )}>
                  {isDone && <span className="text-[10px]">✓</span>}
                  {isProgress && <span className="text-[10px] animate-spin">⚡</span>}
                  {isFailed && <span className="text-[10px]">!</span>}
                </div>
                <div className="flex flex-col">
                  <span className={cn(
                    "font-semibold",
                    isDone && "line-through text-white/30"
                  )}>
                    {todo.id}
                  </span>
                  <span className="text-[11px] text-white/40">{todo.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if ((step.type === PACKET_TYPES.SUBAGENT_CALL || step.type === PACKET_TYPES.SUBAGENT_RESULT) && step.subagent) {
    const s = step.subagent;
    const isCalling = s.status === 'calling';
    const isFailed = s.status === 'failed';

    return (
      <div className={cn(
        "flex flex-col gap-2 rounded-xl border px-4 py-3 transition-all",
        isCalling ? "bg-accent/[0.02] border-accent/25" :
        isFailed ? "bg-error/[0.02] border-error/25" :
        "bg-success/[0.02] border-success/25"
      )}>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest border-b border-white/5 pb-2">
          <Terminal size={12} className={cn(
            isCalling ? "text-accent animate-pulse" :
            isFailed ? "text-error" :
            "text-success"
          )} />
          <span>🤖 Sub-Agent Delegation: {s.name}</span>
          <span className={cn(
            "ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase",
            isCalling ? "bg-accent/20 text-accent animate-pulse" :
            isFailed ? "bg-error/20 text-error" :
            "bg-success/20 text-success"
          )}>
            {s.status}
          </span>
        </div>
        <div className="text-xs text-white/80 mt-1.5">
          <div className="font-semibold text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Instruction</div>
          <p className="bg-black/25 px-2.5 py-2 rounded border border-white/5 text-white/70 italic">{s.instruction}</p>
        </div>
        {s.result && (
          <div className="text-xs text-white/80 mt-2">
            <div className="font-semibold text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Findings & Summary</div>
            <div className="bg-black/40 px-2.5 py-2 rounded border border-white/5 max-h-48 overflow-y-auto scrollbar-hide text-white/60 font-mono text-[10px]">
              <Markdown content={s.result} />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step.type === PACKET_TYPES.FILE_OPERATION && step.fileOp) {
    const f = step.fileOp;
    const isOffload = f.operation === 'offload';

    return (
      <div className={cn(
        "flex flex-col gap-2 rounded-xl border px-3 py-2.5",
        isOffload ? "bg-warning/[0.02] border-warning/20" : "bg-white/[0.01] border-white/5"
      )}>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
          {isOffload ? (
            <AlertTriangle size={11} className="text-warning animate-bounce" />
          ) : (
            <FileText size={11} className="text-muted" />
          )}
          <span>
            {isOffload ? "📦 Context Offloaded" : f.operation === 'write' ? "💾 File Written" : "📖 File Read"}
          </span>
          <span className="ml-auto font-mono text-[9px] text-white/40 break-all">{f.path}</span>
        </div>
        {f.preview && (
          <div className="mt-1">
            <div className="text-[9px] text-white/30 uppercase tracking-wider font-semibold mb-0.5">Preview (First 10 lines)</div>
            <pre className="text-[9px] text-white/40 font-mono bg-black/30 p-2 rounded border border-white/5 whitespace-pre-wrap break-all">
              {f.preview}
            </pre>
          </div>
        )}
      </div>
    );
  }

  if (step.type === PACKET_TYPES.SWARM_STATUS && step.swarm) {
    const s = step.swarm;
    const isFailed = s.status === 'critic_failed' || s.status === 'scrape_failed';
    const isPassed = s.status === 'critic_passed';

    return (
      <div className={cn(
        "flex flex-col gap-2 rounded-xl border px-3.5 py-3 transition-all duration-300",
        isFailed ? "bg-error/[0.02] border-error/20" :
        isPassed ? "bg-success/[0.02] border-success/20" :
        "bg-accent/[0.02] border-accent/15"
      )}>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider border-b border-white/5 pb-2">
          <Cpu size={12} className={cn(
            isFailed ? "text-error" :
            isPassed ? "text-success" :
            "text-accent animate-pulse"
          )} />
          <span>Swarm Researcher (Depth {s.depth})</span>
          <span className={cn(
            "ml-auto text-[8px] font-mono px-2 py-0.5 rounded-full uppercase tracking-tighter",
            isFailed ? "bg-error/10 text-error border border-error/20" :
            isPassed ? "bg-success/10 text-success border border-success/20" :
            "bg-accent/10 text-accent border border-accent/20"
          )}>
            {s.status.replace('_', ' ')}
          </span>
        </div>

        {s.message && (
          <p className="text-[11px] text-white/70 leading-relaxed font-semibold italic mt-0.5">{s.message}</p>
        )}

        {s.url && (
          <div className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded border border-white/5 text-[10px] text-white/50 break-all font-mono">
            <span className="text-accent/60">URL:</span>
            <span>{s.url}</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
          {s.activeAgents !== undefined && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2 flex flex-col">
              <span className="text-[8px] text-white/30 uppercase tracking-wider font-bold">Active Agents</span>
              <span className="text-xs font-bold text-white/80">{s.activeAgents}</span>
            </div>
          )}
          {s.estTime !== undefined && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2 flex flex-col">
              <span className="text-[8px] text-white/30 uppercase tracking-wider font-bold">Est. Wait</span>
              <span className="text-xs font-bold text-white/80">{s.estTime}</span>
            </div>
          )}
          {s.dataSize !== undefined && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2 flex flex-col">
              <span className="text-[8px] text-white/30 uppercase tracking-wider font-bold">Cleaned Size</span>
              <span className="text-xs font-bold text-white/80">{s.dataSize} chars</span>
            </div>
          )}
          {s.discoveredLinks !== undefined && (
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2 flex flex-col">
              <span className="text-[8px] text-white/30 uppercase tracking-wider font-bold">Discovered Links</span>
              <span className="text-xs font-bold text-white/80">{s.discoveredLinks}</span>
            </div>
          )}
        </div>

        {s.factsCount !== undefined && s.factsCount > 0 && (
          <div className="text-[10px] text-success/80 font-semibold bg-success/5 border border-success/10 px-2.5 py-1.5 rounded-lg mt-1 flex items-center gap-1.5">
            <CheckCircle2 size={10} className="text-success" />
            <span>Successfully extracted {s.factsCount} key facts.</span>
          </div>
        )}

        {s.feedback && (
          <div className="text-[10px] text-warning/80 font-mono bg-warning/5 border border-warning/10 px-2.5 py-1.5 rounded-lg mt-1 whitespace-pre-wrap break-all">
            <span className="font-bold uppercase tracking-wider text-[8px] block mb-0.5 text-warning/60">Critic Feedback:</span>
            {s.feedback}
          </div>
        )}
      </div>
    );
  }

  return null;
}
