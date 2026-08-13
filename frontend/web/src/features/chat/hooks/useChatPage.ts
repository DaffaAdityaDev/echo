"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { QUERY_STANDARD } from "@/lib/query-standard";
import { CHAT_QUERY_KEYS } from "../constants";
import { sessionApi } from "../services/chat-api";
import { useChatStore } from "../stores/chatStore";
import type { DbMessage, Message, ThoughtStep } from "../types";
import { useChatStream } from "./useChatStream";
import { useSessions } from "./useSessions";

function parseToolCallContent(content: string): { toolName: string; toolInput: Record<string, unknown> } {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null) {
      const rec = parsed as Record<string, unknown>;
      return {
        toolName: typeof rec.toolName === "string" ? rec.toolName : "",
        toolInput:
          typeof rec.toolInput === "object" && rec.toolInput !== null ? (rec.toolInput as Record<string, unknown>) : {},
      };
    }
  } catch {
    // Not JSON: fall through to the safe default.
  }
  return { toolName: "", toolInput: {} };
}

function groupMessagesByTurn(messages: DbMessage[]): Message[] {
  const turnMap = new Map<number, DbMessage[]>();
  for (const msg of messages) {
    const group = turnMap.get(msg.turn_number) || [];
    group.push(msg);
    turnMap.set(msg.turn_number, group);
  }
  const result: Message[] = [];
  for (const [turnNumber, group] of turnMap) {
    const userMsg = group.find((m) => m.role === "user");
    const assistantMsg = group.find((m) => m.role === "assistant");
    const systemMsg = group.find((m) => m.role === "system");
    if (systemMsg) {
      result.push({
        id: `sys-${turnNumber}-${systemMsg.id}`,
        role: "assistant",
        content: `[System]: ${systemMsg.content}`,
        steps: [],
      });
      continue;
    }
    if (userMsg) {
      result.push({
        id: `user-${turnNumber}-${userMsg.id}`,
        role: "user",
        content: userMsg.content,
        steps: [],
      });
    }
    let steps: ThoughtStep[] = [];
    if (assistantMsg?.steps && assistantMsg.steps.length > 0) {
      steps = assistantMsg.steps;
    } else if (assistantMsg) {
      for (const m of group) {
        if (m.role === "thought") {
          steps.push({ type: "reasoning", content: m.content });
        } else if (m.role === "tool_call") {
          const parsed = parseToolCallContent(m.content);
          steps.push({ type: "tool_call", toolName: parsed.toolName, toolInput: parsed.toolInput });
        } else if (m.role === "tool_result") {
          const colonIdx = m.content.indexOf(" result: ");
          const toolName = colonIdx > 0 ? m.content.substring(0, colonIdx) : "";
          const content = colonIdx > 0 ? m.content.substring(colonIdx + 9) : m.content;
          steps.push({ type: "tool_result", toolName, content });
        }
      }
    }
    const hasSteps = steps.length > 0;
    const hasContent = Boolean(
      assistantMsg?.content ||
        hasSteps ||
        assistantMsg?.status === "streaming" ||
        assistantMsg?.status === "interrupted",
    );
    if (hasContent) {
      result.push({
        id: `asst-${turnNumber}-${assistantMsg?.id || "stream"}`,
        role: "assistant",
        content: assistantMsg?.content || "",
        steps,
        status: assistantMsg?.status,
      });
    }
  }
  return result;
}

export function useChatPage() {
  const { createSession, deleteSession, selectSession } = useSessions();
  const { isAuthenticated } = useAuth();
  const isLoading = useChatStore((s) => s.isLoading);
  const setMessages = useChatStore((s) => s.setMessages);

  const { sendMessage, stopStream, clearMessages } = useChatStream();

  const activeSessionId = useChatStore((s) => s.activeSessionId);

  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError: isMessagesError,
    refetch: refetchMessages,
  } = useInfiniteQuery({
    queryKey: CHAT_QUERY_KEYS.messages(activeSessionId as string),
    queryFn: ({ pageParam = 0 }) => sessionApi.getMessages(activeSessionId as string, 10, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.pagination.offset + lastPage.pagination.limit;
      return nextOffset < lastPage.pagination.total ? nextOffset : undefined;
    },
    enabled: !!activeSessionId && isAuthenticated,
    staleTime: 30_000,
    ...QUERY_STANDARD,
    // Hanya reuse data saat masih di session yang sama; pindah session = clean slate.
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey?.[1] === activeSessionId ? prev : undefined),
  });

  const flattenedMessages = useMemo(
    () => (messagesData ? messagesData.pages.flatMap((page) => page.messages) : []),
    [messagesData],
  );

  // The DB snapshot is authoritative: rebuild the store whenever it changes.
  // Keep the store's last-message identity when the snapshot matches it, so
  // the streaming -> complete transition does not remount MessageItem and
  // replay the token blur-in.
  useEffect(() => {
    if (isLoading) return;

    const sorted = [...flattenedMessages].sort((a, b) => {
      if (a.turn_number !== b.turn_number) {
        return a.turn_number - b.turn_number;
      }
      return a.id - b.id;
    });

    const rebuilt = groupMessagesByTurn(sorted);

    const storeMessages = useChatStore.getState().messages;
    if (rebuilt.length > 0 && storeMessages.length > 0) {
      const lastStore = storeMessages[storeMessages.length - 1];
      const lastRebuilt = rebuilt[rebuilt.length - 1];
      const interruptedBeforeDbCaughtUp =
        lastStore.role === "assistant" &&
        lastRebuilt.role === "assistant" &&
        lastStore.status === "interrupted" &&
        lastRebuilt.status === "streaming" &&
        lastStore.content === lastRebuilt.content;
      if (interruptedBeforeDbCaughtUp) {
        rebuilt[rebuilt.length - 1] = { ...lastRebuilt, id: lastStore.id, status: "interrupted" as const };
      } else if (
        lastStore.role === "assistant" &&
        lastRebuilt.role === "assistant" &&
        lastStore.status === lastRebuilt.status &&
        lastStore.content === lastRebuilt.content &&
        JSON.stringify(lastStore.steps) === JSON.stringify(lastRebuilt.steps)
      ) {
        rebuilt[rebuilt.length - 1] = { ...lastRebuilt, id: lastStore.id };
      }
    }

    setMessages(rebuilt);
  }, [flattenedMessages, isLoading, setMessages]);

  const handleSelectSession = async (id: string) => {
    stopStream();
    clearMessages();
    await selectSession(id);
  };

  const handleCreateSession = async () => {
    stopStream();
    await createSession();
  };

  return {
    sendMessage,
    stopStream,
    clearMessages,
    createSession: handleCreateSession,
    deleteSession,
    selectSession: handleSelectSession,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isMessagesError,
    refetchMessages,
  };
}
