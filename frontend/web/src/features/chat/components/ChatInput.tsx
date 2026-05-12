"use client";

import React, { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput("");
  };

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto relative">
        <form 
          onSubmit={handleSubmit}
          className="relative flex items-center bg-[#111] border border-white/10 rounded-2xl p-1 shadow-2xl focus-within:border-accent/50 transition-all duration-300"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Echo…"
            autoComplete="off"
            spellCheck={false}
            aria-label="Message input"
            className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-sm placeholder:text-white/20 focus:ring-0"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
            className={cn(
              "p-2.5 rounded-xl transition-all duration-300",
              input.trim() && !isLoading 
                ? "bg-accent text-white hover:bg-accent/80 shadow-[0_0_15px_rgba(37,99,235,0.4)]" 
                : "text-white/10"
            )}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <Send size={18} aria-hidden="true" />
            )}
          </button>
        </form>
        <p className="text-[10px] text-center mt-3 text-white/10 uppercase tracking-[0.2em] font-medium select-none" translate="no">
          Next Gen Orchestration • Next.js 15 • Fiber v3
        </p>
      </div>
    </div>
  );
}
