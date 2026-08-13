"use client";

import { Sparkles } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { UI_CONFIG } from "@/constants";
import { CHAT_ROLES } from "../constants";
import type { Message } from "../types";
import { MessageItem } from "./MessageItem";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onScrollBtnChange?: (show: boolean) => void;
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}

export interface MessageListHandle {
  scrollToBottom: () => void;
}

export const MessageList = forwardRef<MessageListHandle, MessageListProps>(function MessageList(
  { messages, isLoading, onScrollBtnChange, fetchNextPage, hasNextPage, isFetchingNextPage },
  ref,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(messages.length);

  const isNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: isLoading ? "auto" : UI_CONFIG.SCROLL_BEHAVIOR });
    }
  }, [isLoading]);

  useImperativeHandle(ref, () => ({ scrollToBottom }), [scrollToBottom]);

  useEffect(() => {
    const prevLength = prevLengthRef.current;
    prevLengthRef.current = messages.length;

    if (messages.length > prevLength) {
      const lastMessage = messages[messages.length - 1];
      const secondToLast = messages[messages.length - 2];

      const justSent = (secondToLast && secondToLast.role === "user") || (lastMessage && lastMessage.role === "user");

      if (justSent) {
        scrollToBottom();
        return;
      }
    }

    if (isNearBottom()) {
      scrollToBottom();
    }
  }, [messages, isNearBottom, scrollToBottom]);

  const handleScroll = useCallback(() => {
    onScrollBtnChange?.(!isNearBottom());

    const el = containerRef.current;
    if (el && el.scrollTop < 50 && hasNextPage && !isFetchingNextPage && fetchNextPage) {
      fetchNextPage();
    }
  }, [isNearBottom, onScrollBtnChange, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ overflowAnchor: "auto" }}
      className="flex-1 overflow-y-auto px-4 py-8 space-y-6 scrollbar-hide relative"
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {isFetchingNextPage && (
          <div className="py-4 flex items-center justify-center gap-2">
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 animate-pulse font-medium">
              Loading older messages...
            </span>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-8 animate-in">
            <div className="relative">
              <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center border border-accent/10">
                <Sparkles size={32} className="text-accent" aria-hidden="true" />
              </div>
              <div className="absolute inset-0 bg-accent/10 blur-3xl rounded-full -z-10" />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-display font-bold tracking-tight">ECHO Systems Ready</h2>
              <p className="text-muted max-w-sm mx-auto text-sm leading-relaxed">
                Enterprise-grade AI orchestration at your fingertips. <br />
                Initialize a mission to begin.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageItem
              key={msg.id}
              msg={msg}
              context={{
                isStreaming:
                  msg.role === CHAT_ROLES.ASSISTANT && (msg.status === "streaming" || (idx === messages.length - 1 && isLoading)),
                isLast: idx === messages.length - 1,
              }}
            />
          ))
        )}
        <div ref={scrollRef} className="h-4" />
      </div>
    </div>
  );
});
