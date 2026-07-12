"use client";

import React, { useRef, useState } from "react";
import { Trash2, Menu, ChevronDown } from "lucide-react";
import { SessionSidebar } from "./SessionSidebar";
import { AgentStatusBadge } from "./AgentStatusBadge";
import { DegradationToast } from "./DegradationToast";
import { ToolCallTimeline } from "./ToolCallTimeline";
import { MessageList, type MessageListHandle } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { AgentProgress } from "./AgentProgress";
import { useChatStore } from "../stores/chatStore";
import { useChatPage } from "../hooks/useChatPage";

interface ChatPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function ChatPage({ sidebarOpen, onToggleSidebar }: ChatPageProps) {
  const { sendMessage, clearMessages, createSession, deleteSession, selectSession } = useChatPage();
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const agentProgress = useChatStore((s) => s.agentProgress);
  const messageListRef = useRef<MessageListHandle>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      <SessionSidebar
        createSession={createSession}
        deleteSession={deleteSession}
        selectSession={selectSession}
        isOpen={sidebarOpen}
        onClose={onToggleSidebar}
      />

      <main className="flex-1 flex flex-col relative" id="main-content">
        <header className="h-16 border-b border-white/5 flex items-center px-4 md:px-8 justify-between glass sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden text-muted hover:text-white p-2 -ml-2 rounded-lg transition-colors hover:bg-white/5"
              onClick={onToggleSidebar}
              aria-label="Open sidebar"
            >
              <Menu size={18} />
            </button>
            <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" aria-hidden="true" />
            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.3em]">
              Node Sync Active • v2.4
            </span>
            <AgentStatusBadge className="ml-2" />
          </div>
          <button
            className="text-muted hover:text-error transition-colors p-2 rounded-lg hover:bg-error/10"
            onClick={clearMessages}
            aria-label="Clear chat history"
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </header>

        <MessageList
          ref={messageListRef}
          messages={messages}
          isLoading={isLoading}
          onScrollBtnChange={setShowScrollBtn}
        />

        {lastAssistantMsg && lastAssistantMsg.steps.length > 0 && (
          <div className="px-4 max-w-3xl mx-auto w-full">
            <ToolCallTimeline steps={lastAssistantMsg.steps} />
          </div>
        )}

        {showScrollBtn && (
          <button
            onClick={() => messageListRef.current?.scrollToBottom()}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 text-xs text-white/70 transition-all shadow-lg"
            aria-label="Scroll to bottom"
          >
            <ChevronDown size={14} />
            New messages below
          </button>
        )}

        {isLoading && <AgentProgress progress={agentProgress} />}

        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </main>

      <DegradationToast />
    </div>
  );
}
