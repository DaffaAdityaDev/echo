"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  Trash2,
  Menu,
  ChevronDown,
  Download,
  ShieldAlert,
  HelpCircle,
  Languages,
  FileText,
  Lightbulb,
  ShieldCheck,
  Settings,
  Cpu,
  Bug,
  Sparkles,
  Wrench,
  Target,
} from "lucide-react";
import { SessionSidebar } from "./SessionSidebar";
import { AgentStatusBadge } from "./AgentStatusBadge";
import { DegradationToast } from "./DegradationToast";
import { ToolCallTimeline } from "./ToolCallTimeline";
import { MessageList, type MessageListHandle } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { AgentProgress } from "./AgentProgress";
import { ModelSelectorModal } from "./ModelSelectorModal";
import { DebugDrawer } from "./DebugDrawer";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { SettingsModal } from "@/features/settings/components/SettingsModal";
import { useChatStore } from "../stores/chatStore";
import { useChatPage } from "../hooks/useChatPage";
import { useModels } from "../hooks/useModels";
import { useAuth } from "@/features/auth/hooks/useAuth";

interface ChatPageProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function ChatPage({ sidebarOpen, onToggleSidebar }: ChatPageProps) {
  const { sendMessage, clearMessages, createSession, deleteSession, selectSession } =
    useChatPage();
  const { user } = useAuth();
  const { models } = useModels();
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const agentProgress = useChatStore((s) => s.agentProgress);
  const missionMeta = useChatStore((s) => s.missionMeta);
  const packetLogs = useChatStore((s) => s.packetLogs);
  const selectedFeatures = useChatStore((s) => s.selectedFeatures);

  const messageListRef = useRef<MessageListHandle>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Modals & Drawers State
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Global Keyboard Shortcut: Ctrl + ` or Ctrl + Shift + D to toggle debug drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === "`") || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d")) {
        e.preventDefault();
        setIsDebugDrawerOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const userName = user?.email ? user.email.split("@")[0] : "Friend";

  // Functional Export Chat Handler
  const handleExportChat = () => {
    if (messages.length === 0) {
      setToastMessage("No chat history available to export.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(messages, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `echo-chat-session-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setToastMessage("Chat session exported to JSON!");
  };

  const promptSuggestions = [
    {
      title: "Synthesize Data",
      description: "Turn my meeting notes into 5 key bullet points for the team",
      icon: FileText,
      prompt: "Turn my meeting notes into 5 key bullet points for the team:",
    },
    {
      title: "Creative Brainstorm",
      description: "Generate 3 taglines for a new sustainable fashion brand",
      icon: Lightbulb,
      prompt: "Generate 3 taglines for a new sustainable fashion brand",
    },
    {
      title: "Check Facts",
      description: "Compare key differences between GDPR and CCPA compliance",
      icon: ShieldCheck,
      prompt: "Compare key differences between GDPR and CCPA compliance",
    },
  ];

  const activeModelObj = models.find((m) => m.id === selectedModel);

  return (
    <div className="h-screen w-screen bg-white dark:bg-zinc-950 text-foreground font-sans overflow-hidden flex relative">
      {/* Toast Feedback */}
      <Toast
        show={!!toastMessage}
        message={toastMessage || ""}
        type="info"
        onClose={() => setToastMessage(null)}
      />

      {/* Settings Overlay Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* Model Selector Modal */}
      <ModelSelectorModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => setIsWorkspaceModalOpen(false)}
      />

      {/* Slide-out Developer Debug Drawer */}
      <DebugDrawer
        isOpen={isDebugDrawerOpen}
        onClose={() => setIsDebugDrawerOpen(false)}
      />

      {/* Help & Shortcuts Modal */}
      <Modal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        title="Help & Keyboard Shortcuts"
        description="Quick guide to operating the Echo AI Harness Platform."
      >
        <div className="space-y-3 text-xs text-zinc-300">
          <div className="flex justify-between py-2 border-b border-zinc-800">
            <span>Toggle Debug Drawer</span>
            <kbd className="px-2 py-0.5 bg-zinc-800 rounded font-mono text-[10px]">Ctrl + `</kbd>
          </div>
          <div className="flex justify-between py-2 border-b border-zinc-800">
            <span>Send Message</span>
            <kbd className="px-2 py-0.5 bg-zinc-800 rounded font-mono text-[10px]">Enter</kbd>
          </div>
          <div className="flex justify-between py-2 border-b border-zinc-800">
            <span>New Line in Message</span>
            <kbd className="px-2 py-0.5 bg-zinc-800 rounded font-mono text-[10px]">Shift + Enter</kbd>
          </div>
          <div className="flex justify-between py-2 border-b border-zinc-800">
            <span>Search Sessions</span>
            <kbd className="px-2 py-0.5 bg-zinc-800 rounded font-mono text-[10px]">⌘ + K</kbd>
          </div>
          <div className="flex justify-between py-2">
            <span>Close Modal</span>
            <kbd className="px-2 py-0.5 bg-zinc-800 rounded font-mono text-[10px]">Esc</kbd>
          </div>
        </div>
      </Modal>

      <SessionSidebar
        createSession={createSession}
        deleteSession={deleteSession}
        selectSession={selectSession}
        isOpen={sidebarOpen}
        onClose={onToggleSidebar}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      <main className="flex-1 flex flex-col h-full relative min-w-0" id="main-content">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between px-6 shrink-0 z-20 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden text-zinc-500 hover:text-zinc-900 dark:hover:text-white p-1.5 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              onClick={onToggleSidebar}
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Model Selector Header Button */}
            <button
              onClick={() => setIsWorkspaceModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
              title="Select Intelligence Model"
            >
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <Cpu className="h-3.5 w-3.5 text-purple-500" />
              <span>{activeModelObj?.name || "Echo Brain"}</span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            </button>

            <AgentStatusBadge />
          </div>

          {/* Header Right Actions */}
          <div className="flex items-center gap-2">
            {/* Debug Drawer Toggle Button */}
            <button
              onClick={() => setIsDebugDrawerOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-semibold hover:bg-purple-500/20 transition-all cursor-pointer relative"
              title="Toggle Developer Debug Drawer (Ctrl + `)"
            >
              <Bug className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Debug</span>
              {packetLogs.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Agent Settings"
            >
              <Settings className="h-4 w-4" />
            </button>

            <button
              onClick={clearMessages}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Clear Chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            <button
              onClick={handleExportChat}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors hidden sm:inline-flex cursor-pointer"
              title="Export Chat JSON"
            >
              <Download className="h-4 w-4" />
            </button>

            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-white transition-all shadow-sm"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Admin Console</span>
            </Link>
          </div>
        </header>

        {/* Phase 2: Header Mission Info Bar */}
        <div className="h-10 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-950/30 px-6 flex items-center justify-between text-xs shrink-0 select-none overflow-x-auto">
          <div className="flex items-center gap-3">
            {/* Strategy Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold text-[11px] border border-purple-500/20">
              <Sparkles className="h-3 w-3" />
              <span>{missionMeta?.strategy ? `${missionMeta.strategy.toUpperCase()}` : "REACT AGENT"}</span>
            </div>

            {/* Objective Pill */}
            <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 text-[11px] font-medium truncate max-w-xs md:max-w-md">
              <Target className="h-3 w-3 text-purple-500 shrink-0" />
              <span className="truncate">
                {missionMeta?.objective || "Autonomous AI Harness Engine"}
              </span>
            </div>
          </div>

          {/* Active Tools Count */}
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800/60 border border-zinc-300/40 dark:border-zinc-700/40">
              <Wrench className="h-3 w-3 text-purple-400" />
              <span>{missionMeta?.toolsAvailable?.length ?? selectedFeatures.length} Capabilities Active</span>
            </div>
          </div>
        </div>

        {/* Main Body: Welcome Hero or Message Stream */}
        {messages.length === 0 ? (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col justify-between items-center text-center">
              <div className="w-full max-w-5xl my-auto space-y-8 flex flex-col items-center">
              {/* Pure SVG Ambient Orb Graphic */}
              <div className="relative w-24 h-24 flex items-center justify-center my-2">
                <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-2xl animate-pulse" />
                <svg
                  className="w-20 h-20 relative z-10 drop-shadow-xl"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <radialGradient id="purpleOrbGrad" cx="35%" cy="35%" r="65%">
                      <stop offset="0%" stopColor="#C084FC" />
                      <stop offset="50%" stopColor="#9333EA" />
                      <stop offset="100%" stopColor="#4C1D95" />
                    </radialGradient>
                    <filter id="glowBlur" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  <circle cx="50" cy="50" r="42" fill="url(#purpleOrbGrad)" filter="url(#glowBlur)" />
                  <circle cx="38" cy="38" r="14" fill="#FFFFFF" fillOpacity="0.25" />
                </svg>
              </div>

              {/* Welcome Typography */}
              <div className="space-y-2">
                <h2 className="text-xl md:text-2xl font-semibold text-purple-600 dark:text-purple-400 font-display tracking-tight">
                  Hello, {userName}
                </h2>
                <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 dark:text-white font-display tracking-tight">
                  How can I assist you today?
                </h1>
              </div>

              {/* Floating Input Box */}
              <div className="w-full pt-2">
                <ChatInput onSend={sendMessage} isLoading={isLoading} />
              </div>

              {/* Prompt Suggestion Cards (3-Column Grid) */}
              <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                {promptSuggestions.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => sendMessage(item.prompt)}
                      className="p-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-900/50 hover:border-purple-500/40 hover:bg-white dark:hover:bg-zinc-900 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between space-y-3"
                    >
                      <div className="p-2 w-fit rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed line-clamp-2 font-normal">
                          {item.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Footer Line */}
            <div className="w-full max-w-5xl flex items-center justify-between pt-6 border-t border-zinc-200/50 dark:border-zinc-800/50 text-[11px] text-zinc-400">
              <a
                href="/docs"
                className="hover:text-purple-500 transition-colors font-medium"
              >
                Explore Echo Developer Documentation & APIs
              </a>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setToastMessage("System language set to English (US)")}
                  className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  title="Language Selector"
                >
                  <Languages className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsHelpModalOpen(true)}
                  className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  title="Help & Shortcuts"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            <MessageList
              ref={messageListRef}
              messages={messages}
              isLoading={isLoading}
              onScrollBtnChange={setShowScrollBtn}
            />

            {lastAssistantMsg && lastAssistantMsg.steps.length > 0 && (
              <div className="px-4 max-w-5xl mx-auto w-full">
                <ToolCallTimeline steps={lastAssistantMsg.steps} />
              </div>
            )}

            {showScrollBtn && (
              <button
                onClick={() => messageListRef.current?.scrollToBottom()}
                className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 bg-zinc-900/80 hover:bg-zinc-900 text-white border border-zinc-700 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 text-xs transition-all shadow-xl cursor-pointer"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                <span>New messages below</span>
              </button>
            )}

            {isLoading && <AgentProgress progress={agentProgress} />}

            <div className="p-4">
              <ChatInput onSend={sendMessage} isLoading={isLoading} />
            </div>
          </div>
        )}
      </main>

      <DegradationToast />
    </div>
  );
}
