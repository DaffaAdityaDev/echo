"use client";

import React, { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageItem } from "./MessageItem";
import { Message } from "../types";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

import { UI_CONFIG } from "@/constants";

export function MessageList({ messages, isLoading }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: UI_CONFIG.SCROLL_BEHAVIOR });
    }
  };


  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 space-y-6 scrollbar-hide">
      <div className="max-w-3xl mx-auto space-y-8">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center space-y-8"
            >
              <div className="relative">
                <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center border border-accent/10">
                  <Sparkles size={32} className="text-accent" aria-hidden="true" />
                </div>
                <div className="absolute inset-0 bg-accent/10 blur-3xl rounded-full -z-10" />
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-display font-bold tracking-tight">ECHO Systems Ready</h2>
                <p className="text-muted max-w-sm mx-auto text-sm leading-relaxed">
                  Enterprise-grade AI orchestration at your fingertips. <br/>
                  Initialize a mission to begin.
                </p>
              </div>
            </motion.div>
          ) : (
            messages.map((msg, idx) => (
              <MessageItem 
                key={msg.id} 
                msg={msg} 
                isLast={idx === messages.length - 1}
                isLoading={isLoading}
              />
            ))
          )}
        </AnimatePresence>
        <div ref={scrollRef} className="h-4" />
      </div>
    </div>
  );
}
