"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { useTraceStore } from "@/features/debug/stores/traceStore";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { extractErrorMessage } from "@/utils/error";
import { CHAT_QUERY_KEYS, CHAT_ROLES } from "../constants";
import { chatApi, sessionApi } from "../services/chat-api";
import { applyStreamPacket } from "../services/stream";
import { notifySystem } from "../services/system-notice";
import { useChatStore } from "../stores/chatStore";
import type { Message, StreamPacket } from "../types";

async function generateSessionTitle(sid: string): Promise<void> {
  const state = useChatStore.getState();
  const model = useSettingsStore.getState().config.defaultModel;
  if (!sid || !model) return;

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

// Stream control is scoped to the hook instance that started the stream:
// module-level AbortControllers would let one mounted instance abort a
// stream owned by another instance (e.g. a stale page transition or a
// second chat page). Stop buttons reach the controller through the same
// instance's sendMessage, so single-instance behavior is unchanged.
export function useChatStream() {
  const isLoading = useChatStore((s) => s.isLoading);
  const setMessages = useChatStore((s) => s.setMessages);
  const setIsLoading = useChatStore((s) => s.setIsLoading);
  const setAgentProgress = useChatStore((s) => s.setAgentProgress);
  const setAgentState = useChatStore((s) => s.setAgentState);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const queryClient = useQueryClient();
  const router = useRouter();
  const activeAbortRef = useRef<AbortController | null>(null);
  const interruptedTurnRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);

  const stopStreaming = useCallback(() => {
    const controller = activeAbortRef.current;
    if (!controller) return;
    interruptedTurnRef.current = true;
    controller.abort();
    activeAbortRef.current = null;

    const sid = useChatStore.getState().activeSessionId;
    if (sid) {
      // Finalize any streaming trace for this session immediately, and tell
      // the backend to interrupt the mission (aborts the in-flight LLM
      // stream). Fire-and-forget: the fetch abort alone already stops the
      // stream; the cancel request makes the stop prompt across the chain.
      useTraceStore.getState().finalizeInterruptedForSession(sid);
      const cancelController = new AbortController();
      const cancelTimeout = setTimeout(() => cancelController.abort(), 5000);
      sessionApi
        .cancel(sid, cancelController.signal)
        .catch((err: unknown) => {
          // The 5s timeout aborts the request via the controller; not a failure.
          if ((err as { code?: string } | null)?.code !== "ERR_CANCELED") {
            notifySystem("warning", "CANCEL_FAILED", "Failed to cancel the in-flight mission.");
          }
        })
        .finally(() => clearTimeout(cancelTimeout));
    }

    useChatStore.getState().setIsLoading(false);
    useChatStore.getState().setAgentProgress(null);
    useChatStore.getState().setAgentState("aborted");
  }, []);

  const sendMessage = async (input: string) => {
    if (!input.trim() || isLoading) return;

    interruptedTurnRef.current = false;
    const userMessage: Message = {
      role: CHAT_ROLES.USER,
      content: input,
      steps: [],
      id: crypto.randomUUID(),
    };

    const assistantMessage: Message = {
      role: CHAT_ROLES.ASSISTANT,
      content: "",
      steps: [],
      id: crypto.randomUUID(),
      status: "streaming",
    };

    try {
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);
      setAgentState("running");
      setAgentProgress({
        iteration: 0,
        totalIterations: 0,
      });

      activeAbortRef.current = new AbortController();

      const payload: Record<string, unknown> = { message: input };
      const activeSessionId = useChatStore.getState().activeSessionId;
      if (activeSessionId) {
        payload.sessionId = activeSessionId;
      }

      await chatApi.sendMessage(
        payload,
        (data: StreamPacket) => {
          applyStreamPacket(data);
        },
        activeAbortRef.current.signal,
        (response: Response) => {
          const sessionId = response.headers.get("X-Session-ID");
          if (sessionId && useChatStore.getState().activeSessionId === null) {
            useChatStore.getState().setActiveSession(sessionId);
            useChatStore.getState().setNewChatPending(false);
            // Defer navigation until the turn ends: pushing mid-stream can drop
            // the streaming connection (the mission is then cancelled for token
            // safety). The finally block navigates once the stream completes.
            pendingNavigationRef.current = sessionId;
            queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.sessions, exact: true });
          }
        },
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const store = useChatStore.getState();
      store.setAgentState("error");
      const currentMsgs = store.messages;
      if (currentMsgs.length === 0) return;
      const lastIdx = currentMsgs.length - 1;
      const errorMessage = extractErrorMessage(err, "Failed to fetch response from agent.");
      notifySystem("error", "STREAM_FAILED", errorMessage);
      const prevContent = currentMsgs[lastIdx]?.content || "";
      const updatedContent = prevContent ? `${prevContent}\n\n[Error: ${errorMessage}]` : `Error: ${errorMessage}`;
      const lastMessage = {
        ...currentMsgs[lastIdx],
        content: updatedContent,
      };
      store.setMessages([...currentMsgs.slice(0, -1), lastMessage]);
    } finally {
      const store = useChatStore.getState();
      const currentMsgs = store.messages;
      if (currentMsgs.length > 0) {
        const lastIdx = currentMsgs.length - 1;
        if (currentMsgs[lastIdx].role === CHAT_ROLES.ASSISTANT && currentMsgs[lastIdx].status === "streaming") {
          const updated = [...currentMsgs];
          updated[lastIdx] = {
            ...updated[lastIdx],
            status: interruptedTurnRef.current ? ("interrupted" as const) : ("complete" as const),
          };
          store.setMessages(updated);
        }
      }

      const sid = store.activeSessionId;
      if (sid) {
        try {
          await queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.messages(sid) });
        } catch {
          notifySystem("warning", "MESSAGE_REFRESH_FAILED", "Failed to refresh the message list.");
        }
      }

      setIsLoading(false);
      setAgentProgress(null);

      const pendingSid = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      if (pendingSid && store.activeSessionId === pendingSid) {
        router.push(`/session/${pendingSid}`);
      }

      // Auto-generate title if still default, then refresh the session list.
      // Title generation bumps updated_at, so the paginated list must refetch;
      // invalidating exact ["sessions"] avoids refetching the messages queries.
      try {
        await generateSessionTitle(sid || "");
        await queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.sessions, exact: true });
      } catch {
        notifySystem("warning", "SESSION_REFRESH_FAILED", "Failed to refresh the session list.");
      }
    }
  };

  const stopStream = useCallback(() => {
    stopStreaming();
  }, [stopStreaming]);

  const handleClearMessages = useCallback(() => {
    stopStream();
    clearMessages();
  }, [stopStream, clearMessages]);

  return {
    sendMessage,
    stopStream,
    isLoading,
    clearMessages: handleClearMessages,
  };
}
