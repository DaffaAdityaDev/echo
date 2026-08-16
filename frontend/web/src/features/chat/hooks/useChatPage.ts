"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { QUERY_STANDARD } from "@/lib/query-standard";
import { CHAT_QUERY_KEYS } from "../constants";
import { groupMessagesByTurn } from "../lib/group-messages";
import { sessionApi } from "../services/chat-api";
import { useChatStore } from "../stores/chatStore";
import type { DbMessage } from "../types";
import { useChatStream } from "./useChatStream";
import { useSessions } from "./useSessions";

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
    queryFn: ({ pageParam = 0 }) => sessionApi.getMessages(activeSessionId as string, 10, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.pagination.offset + lastPage.pagination.limit;
      return nextOffset < lastPage.pagination.total ? nextOffset : undefined;
    },
    enabled: !!activeSessionId && isAuthenticated,
    staleTime: 30_000,
    ...QUERY_STANDARD,
    // Reuse previous page data only while the session is unchanged; switching sessions is a clean slate.
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
