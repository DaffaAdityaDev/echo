"use client";

import { ChevronDown } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
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
import {
  MessagesErrorState,
  MessagesLoadingState,
  MessagesRefreshErrorBanner,
  SessionUnavailableState,
} from "./chat-page/ChatBodyStates";
import { ChatHeader } from "./chat-page/ChatHeader";
import { HelpShortcutsModal } from "./chat-page/HelpShortcutsModal";
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
    isMessagesLoading,
    isMessagesError,
    isSessionUnavailable,
    refetchMessages,
  } = useChatPage();

  const { user } = useAuth();
  const { models } = useModels();
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const agentProgress = useChatStore((s) => s.agentProgress);
  const missionMeta = useChatStore((s) => s.missionMeta);
  const packetCount = useChatStore((s) => s.packetLogs.length);
  const { defaultModel, defaultFeatures } = useSettingsStore((s) => s.config);

  const messageListRef = useRef<MessageListHandle>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const { showToast } = useToast();
  const { copy } = useCopyToClipboard();

  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDebugDrawerOpen, setIsDebugDrawerOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Ctrl + ` or Ctrl + Shift + D toggles the debug drawer.
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

  const renderEmptyBody = () => {
    if (isSessionUnavailable) return <SessionUnavailableState onCreateSession={createSession} />;

    if (isMessagesError) return <MessagesErrorState onRetry={() => refetchMessages()} />;

    if (isMessagesLoading) return <MessagesLoadingState />;

    return (
      <WelcomeHero
        userName={userName}
        onSend={sendMessage}
        onStop={stopStream}
        isLoading={isLoading}
        onOpenHelp={() => setIsHelpModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />
    );
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background text-foreground font-sans overflow-hidden">
      {isSettingsModalOpen && (
        <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
      )}

      <ModelSelectorModal isOpen={isWorkspaceModalOpen} onClose={() => setIsWorkspaceModalOpen(false)} />

      <DebugDrawer isOpen={isDebugDrawerOpen} onClose={() => setIsDebugDrawerOpen(false)} />

      <HelpShortcutsModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />

      <main className="flex-1 flex flex-col min-h-0 relative" id="main-content">
        <ChatHeader
          activeModelName={activeModelName}
          packetCount={packetCount}
          isLoading={isLoading}
          onStop={stopStream}
          onOpenWorkspace={() => setIsWorkspaceModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onToggleDebug={() => setIsDebugDrawerOpen((v) => !v)}
          onCreateSession={createSession}
          onShareSession={handleShareSession}
          onExportChat={handleExportChat}
        />

        <MissionInfoBar missionMeta={missionMeta} selectedFeatures={defaultFeatures} />

        {messages.length === 0 ? (
          renderEmptyBody()
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            {isMessagesError && <MessagesRefreshErrorBanner onRetry={() => refetchMessages()} />}
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
                className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 bg-foreground/90 hover:bg-foreground text-background backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 text-xs font-medium transition-all shadow-xl cursor-pointer"
              >
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                <span>New messages below</span>
              </button>
            )}

            {isLoading && <AgentProgress progress={agentProgress} />}

            <div className="p-3 sm:p-4">
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
