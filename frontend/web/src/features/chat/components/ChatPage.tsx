"use client";

import { ChevronDown } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useToast } from "@/hooks/useToast";
import { downloadJson } from "@/utils/download";
import { useChatPage } from "../hooks/useChatPage";
import { useModels } from "../hooks/useModels";
import { resolveDefaultModel } from "../model-match";
import { useChatStore } from "../stores/chatStore";
import { AgentProgress } from "./AgentProgress";
import { ChatInput } from "./ChatInput";
import { ChatHeader } from "./chat-page/ChatHeader";
import { MissionInfoBar } from "./chat-page/MissionInfoBar";
import { WelcomeHero } from "./chat-page/WelcomeHero";
import { DegradationToast } from "./DegradationToast";
import { HitlApprovalModal } from "./HitlApprovalModal";
import { MessageList, type MessageListHandle } from "./MessageList";
import { SystemNoticeToast } from "./SystemNoticeToast";
import { ToolCallTimeline } from "./ToolCallTimeline";

const ModelSelectorModal = dynamic(() => import("./ModelSelectorModal").then((m) => m.ModelSelectorModal), {
  ssr: false,
  loading: () => null,
});

const DebugDrawer = dynamic(() => import("./debug/DebugDrawer").then((m) => m.DebugDrawer), {
  ssr: false,
  loading: () => null,
});

const SettingsModal = dynamic(
  () => import("@/features/settings/components/SettingsModal").then((m) => m.SettingsModal),
  {
    ssr: false,
    loading: () => null,
  },
);

export function ChatPage() {
  const {
    sendMessage,
    stopStream,
    createSession,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isMessagesError,
    refetchMessages,
  } = useChatPage();
  const { user } = useAuth();
  const { models } = useModels();
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const agentProgress = useChatStore((s) => s.agentProgress);
  const missionMeta = useChatStore((s) => s.missionMeta);
  const packetLogs = useChatStore((s) => s.packetLogs);
  const { defaultModel, defaultFeatures } = useSettingsStore((s) => s.config);

  const messageListRef = useRef<MessageListHandle>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const { showToast } = useToast();
  const { copy } = useCopyToClipboard();

  // Modals & Drawers State
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

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
      showToast("No chat history available to export.", "info");
      return;
    }
    downloadJson(`echo-chat-session-${Date.now()}.json`, messages);
    showToast("Chat session exported to JSON!", "success");
  };

  const activeSessionId = useChatStore((s) => s.activeSessionId);

  const handleShareSession = () => {
    if (!activeSessionId) {
      showToast("No active session selected.", "info");
      return;
    }
    void copy(`${window.location.origin}/session/${activeSessionId}`);
    showToast("Session URL copied to clipboard!", "success");
  };

  const activeModelName = resolveDefaultModel(models, defaultModel)?.name || "Echo Brain";

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-950 text-foreground font-sans overflow-hidden">
      {/* Settings Overlay Modal (lazy: chunk + data fetch hanya saat dibuka) */}
      {isSettingsModalOpen && (
        <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
      )}

      {/* Model Selector Modal */}
      <ModelSelectorModal isOpen={isWorkspaceModalOpen} onClose={() => setIsWorkspaceModalOpen(false)} />

      {/* Slide-out Developer Debug Drawer */}
      <DebugDrawer isOpen={isDebugDrawerOpen} onClose={() => setIsDebugDrawerOpen(false)} />

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
            <kbd className="px-2 py-0.5 bg-zinc-800 rounded font-mono text-[10px]">⌘K / Ctrl+K</kbd>
          </div>
          <div className="flex justify-between py-2">
            <span>Close Modal</span>
            <kbd className="px-2 py-0.5 bg-zinc-800 rounded font-mono text-[10px]">Esc</kbd>
          </div>
        </div>
      </Modal>

      <main className="flex-1 flex flex-col min-h-0 relative" id="main-content">
        <ChatHeader
          activeModelName={activeModelName}
          packetCount={packetLogs.length}
          isLoading={isLoading}
          onStop={stopStream}
          onOpenWorkspace={() => setIsWorkspaceModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onToggleDebug={() => setIsDebugDrawerOpen((v) => !v)}
          onCreateSession={createSession}
          onShareSession={handleShareSession}
          onExportChat={handleExportChat}
        />

        {/* Phase 2: Header Mission Info Bar */}
        <MissionInfoBar missionMeta={missionMeta} selectedFeatures={defaultFeatures} />

        {/* Main Body: Welcome Hero or Message Stream */}
        {messages.length === 0 ? (
          isMessagesError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Failed to load messages</p>
              <button
                type="button"
                onClick={() => refetchMessages()}
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <WelcomeHero
              userName={userName}
              onSend={sendMessage}
              onStop={stopStream}
              isLoading={isLoading}
              onOpenHelp={() => setIsHelpModalOpen(true)}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
            />
          )
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            {isMessagesError && (
              <div className="flex items-center justify-between px-4 py-1.5 bg-red-500/5 border-b border-red-500/20">
                <p className="text-[10px] text-red-500/80">Failed to refresh messages</p>
                <button
                  type="button"
                  onClick={() => refetchMessages()}
                  className="text-[10px] font-semibold text-red-500 hover:underline cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}
            <MessageList
              ref={messageListRef}
              messages={messages}
              isLoading={isLoading}
              onScrollBtnChange={setShowScrollBtn}
              fetchNextPage={fetchNextPage}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
            />

            {lastAssistantMsg && lastAssistantMsg.steps.length > 0 && (
              <div className="px-4 max-w-5xl mx-auto w-full">
                <ToolCallTimeline steps={lastAssistantMsg.steps} />
              </div>
            )}

            {showScrollBtn && (
              <button
                type="button"
                onClick={() => messageListRef.current?.scrollToBottom()}
                className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 bg-zinc-900/80 hover:bg-zinc-900 text-white border border-zinc-700 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 text-xs transition-all shadow-xl cursor-pointer"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                <span>New messages below</span>
              </button>
            )}

            {isLoading && <AgentProgress progress={agentProgress} />}

            <div className="p-4">
              <ChatInput
                onSend={sendMessage}
                onStop={stopStream}
                isLoading={isLoading}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
              />
            </div>
          </div>
        )}
      </main>

      <DegradationToast />
      <HitlApprovalModal />
      <SystemNoticeToast />
    </div>
  );
}
