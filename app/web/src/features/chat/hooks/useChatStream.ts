"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { extractErrorMessage } from "@/utils/error";
import { CHAT_QUERY_KEYS, CHAT_ROLES } from "../constants";
import { chatApi, sessionApi } from "../services/chat-api";
import { applyStreamPacket } from "../services/stream";
import { stopActiveStream } from "../services/stream/stop-stream";
import {
  bindStreamRunSession,
  finishStreamRun,
  isActiveStreamRun,
  isLatestStreamRun,
  markStreamRunSnapshotRequested,
  type StreamRun,
  startStreamRun,
} from "../services/stream/stream-run";
import { notifySystem } from "../services/system-notice";
import { useChatStore } from "../stores/chatStore";
import type { Message, StreamPacket } from "../types";

async function generateSessionTitle(sid: string): Promise<void> {
  const state = useChatStore.getState();
  // An empty model lets the backend fall back to its configured default.
  const model = useSettingsStore.getState().config.defaultModel;

  const activeSess = state.sessions.find((s) => s.id === sid);

  if (activeSess?.title && activeSess.title !== "New Chat") return;

  try {
    const { title, summary } = await sessionApi.generateTitle(sid, model);

    if (!title) return;
    const store = useChatStore.getState();
    store.setSessions(
      store.sessions.map((s) => (s.id === sid ? { ...s, title, contextSummary: summary || s.contextSummary } : s)),
    );
  } catch {
    notifySystem("warning", "TITLE_GENERATION_FAILED", "Failed to auto-generate the session title.");
  }
}

function newTurnMessages(input: string): [Message, Message] {
  return [
    { role: CHAT_ROLES.USER, content: input, steps: [], id: crypto.randomUUID() },
    { role: CHAT_ROLES.ASSISTANT, content: "", steps: [], id: crypto.randomUUID(), status: "streaming" },
  ];
}

function updateMessage(messageId: string, update: (m: Message) => Message): void {
  useChatStore.getState().setMessages((prev) => prev.map((m) => (m.id === messageId ? update(m) : m)));
}

// Packets are written only while the run is live and the store still shows
// the session the run belongs to; anything else would land in another chat.
function runOwnsStore(run: StreamRun): boolean {
  if (!isActiveStreamRun(run)) return false;

  return run.sessionId === null || run.sessionId === useChatStore.getState().activeSessionId;
}

function reportStreamFailure(run: StreamRun, err: unknown): void {
  const errorMessage = extractErrorMessage(err instanceof Error ? err : null, "Failed to fetch response from agent.");
  useChatStore.getState().setAgentState("error");
  notifySystem("error", "STREAM_FAILED", errorMessage);
  updateMessage(run.assistantMessageId, (m) => ({
    ...m,
    content: m.content ? `${m.content}\n\n[Error: ${errorMessage}]` : `Error: ${errorMessage}`,
    status: "error",
  }));
}

export function useChatStream() {
  const isLoading = useChatStore((s) => s.isLoading);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const queryClient = useQueryClient();
  const router = useRouter();

  const refreshMessages = async (run: StreamRun): Promise<void> => {
    if (!run.sessionId) return;
    markStreamRunSnapshotRequested(run, Date.now());

    try {
      await queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.messages(run.sessionId) });
    } catch {
      notifySystem("warning", "MESSAGE_REFRESH_FAILED", "Failed to refresh the message list.");
    }
  };

  // Title generation bumps updated_at, so the paginated list must refetch;
  // invalidating exact ["sessions"] avoids refetching the messages queries.
  const refreshSessionTitle = async (sid: string | null): Promise<void> => {
    if (!sid) return;

    try {
      await generateSessionTitle(sid);
      await queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.sessions, exact: true });
    } catch {
      notifySystem("warning", "SESSION_REFRESH_FAILED", "Failed to refresh the session list.");
    }
  };

  const settleStreamRun = async (run: StreamRun, pendingNavigation: string | null): Promise<void> => {
    // A stopped or superseded run was already finalized by stopActiveStream.
    if (isActiveStreamRun(run)) {
      finishStreamRun(run);
      updateMessage(run.assistantMessageId, (m) => (m.status === "streaming" ? { ...m, status: "complete" } : m));
    }

    await refreshMessages(run);

    // A newer run owns the loading flags and the route from here on.
    if (isLatestStreamRun(run)) {
      const store = useChatStore.getState();
      store.setIsLoading(false);
      store.setAgentProgress(null);

      if (pendingNavigation && store.activeSessionId === pendingNavigation) {
        router.push(`/session/${pendingNavigation}`);
      }
    }

    await refreshSessionTitle(run.sessionId);
  };

  const sendMessage = async (input: string) => {
    if (!input.trim() || useChatStore.getState().isLoading) return;

    const [userMessage, assistantMessage] = newTurnMessages(input);
    const store = useChatStore.getState();
    const run = startStreamRun(store.activeSessionId, assistantMessage.id);
    let pendingNavigation: string | null = null;

    store.setMessages((prev) => [...prev, userMessage, assistantMessage]);
    store.setIsLoading(true);
    store.setAgentState("running");
    store.setAgentProgress({ iteration: 0, totalIterations: 0 });

    const bindNewSession = (response: Response) => {
      const sessionId = response.headers.get("X-Session-ID");

      if (!sessionId || run.sessionId !== null || !isActiveStreamRun(run)) return;
      bindStreamRunSession(run, sessionId);
      useChatStore.getState().setActiveSession(sessionId);
      useChatStore.getState().setNewChatPending(false);
      // Defer navigation until the turn ends: pushing mid-stream can drop
      // the streaming connection (the mission is then cancelled for token
      // safety). settleStreamRun navigates once the stream completes.
      pendingNavigation = sessionId;
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.sessions, exact: true });
    };

    try {
      const payload = run.sessionId ? { message: input, sessionId: run.sessionId } : { message: input };

      await chatApi.sendMessage(
        payload,
        (data: StreamPacket) => {
          if (runOwnsStore(run)) applyStreamPacket(data);
        },
        run.controller.signal,
        bindNewSession,
      );
    } catch (err: unknown) {
      if (!run.controller.signal.aborted && isActiveStreamRun(run)) reportStreamFailure(run, err);
    } finally {
      await settleStreamRun(run, pendingNavigation);
    }
  };

  const stopStream = useCallback(() => {
    stopActiveStream();
  }, []);

  const handleClearMessages = useCallback(() => {
    stopActiveStream();
    clearMessages();
  }, [clearMessages]);

  return {
    sendMessage,
    stopStream,
    isLoading,
    clearMessages: handleClearMessages,
  };
}
