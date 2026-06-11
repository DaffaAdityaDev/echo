"use client";

import React, { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { useChatStream } from "../api/useChatStream";
import { useModels } from "../api/useModels";
import { CHAT_MODES } from "../constants";
import { useFeatures, AgentFeature } from "../api/useFeatures";

export function ChatInterface() {
  const [selectedModel, setSelectedModel] = useState("");
  const [mode, setMode] = useState<typeof CHAT_MODES[keyof typeof CHAT_MODES]>(CHAT_MODES.STANDARD);
  const { features } = useFeatures();
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [prevFeatures, setPrevFeatures] = useState<AgentFeature[]>([]);

  if (features !== prevFeatures) {
    setPrevFeatures(features);
    setSelectedFeatures(features.filter(f => !f.locked).map(f => f.id));
  }

  
  const { models } = useModels();
  const activeModelId = selectedModel || models[0]?.id || "";
  const { messages, isLoading, sendMessage, clearMessages } = useChatStream(activeModelId, mode, selectedFeatures);


  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      <Sidebar 
        mode={mode} 
        setMode={setMode} 
        selectedModel={selectedModel} 
        setSelectedModel={setSelectedModel} 
        selectedFeatures={selectedFeatures}
        setSelectedFeatures={setSelectedFeatures}
      />

      <main className="flex-1 flex flex-col relative" id="main-content">
        {/* Header */}
        <header className="h-16 border-b border-white/5 flex items-center px-8 justify-between glass sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" aria-hidden="true" />
            <span className="text-[10px] font-bold text-muted uppercase tracking-[0.3em]">
              Node Sync Active • v2.4
            </span>
          </div>
          <button 
            className="text-muted hover:text-error transition-colors p-2 rounded-lg hover:bg-error/10" 
            onClick={clearMessages}
            aria-label="Clear chat history"
          >
            <Trash2 size={18} aria-hidden="true" />
          </button>
        </header>

        {/* Chat Area */}
        <MessageList messages={messages} isLoading={isLoading} />

        {/* Input Area */}
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </main>
    </div>
  );
}
