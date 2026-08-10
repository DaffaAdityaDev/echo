"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { extractErrorMessage } from "@/utils/error";
import { CHAT_QUERY_KEYS, CHAT_ROLES } from "../constants";
import { chatApi, sessionApi } from "../services/chat-api";
import { applyStreamPacket } from "../services/stream";
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
  } catch (err) {
    console.warn("[Chat] Failed to auto-generate title:", err);
  }
}

export function useChatStream() {
  const isLoading = useChatStore((s) => s.isLoading);
  const setMessages = useChatStore((s) => s.setMessages);
  const setIsLoading = useChatStore((s) => s.setIsLoading);
  const setAgentProgress = useChatStore((s) => s.setAgentProgress);
  const setAgentState = useChatStore((s) => s.setAgentState);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const queryClient = useQueryClient();
  const router = useRouter();

  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = async (input: string) => {
    if (!input.trim() || isLoading) return;

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

      abortRef.current = new AbortController();

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
        abortRef.current.signal,
        (response: Response) => {
          const sessionId = response.headers.get("X-Session-ID");
          if (sessionId && useChatStore.getState().activeSessionId === null) {
            useChatStore.getState().setActiveSession(sessionId);
            useChatStore.getState().setNewChatPending(false);
            router.push(`/session/${sessionId}`);
            queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.sessions, exact: true });
          }
        },
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Chat error:", err);
      const store = useChatStore.getState();
      store.setAgentState("error");
      const currentMsgs = store.messages;
      if (currentMsgs.length === 0) return;
      const lastIdx = currentMsgs.length - 1;
      const errorMessage = extractErrorMessage(err, "Failed to fetch response from agent.");
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
          updated[lastIdx] = { ...updated[lastIdx], status: "complete" };
          store.setMessages(updated);
        }
      }

      const sid = store.activeSessionId;
      if (sid) {
        try {
          await queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.messages(sid) });
        } catch (err) {
          console.warn("[Chat] Failed to invalidate messages query:", err);
        }
      }

      setIsLoading(false);
      setAgentProgress(null);

      // Auto-generate title if still default, then refresh the session list.
      // Title generation bumps updated_at, so the paginated list must refetch;
      // invalidating exact ["sessions"] avoids refetching the messages queries.
      try {
        await generateSessionTitle(sid || "");
        await queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.sessions, exact: true });
      } catch (err) {
        console.warn("[Chat] Failed to refresh sessions:", err);
      }
    }
  };

  const stopStream = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setIsLoading(false);
      setAgentProgress(null);
      useChatStore.getState().setAgentState("aborted");
    }
  };

  const handleClearMessages = () => {
    stopStream();
    clearMessages();
  };

  return {
    sendMessage,
    stopStream,
    isLoading,
    clearMessages: handleClearMessages,
  };
}
