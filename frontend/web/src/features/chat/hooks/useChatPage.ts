"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { QUERY_STANDARD } from "@/lib/query-standard";
import { CHAT_MODES, CHAT_QUERY_KEYS } from "../constants";
import { sessionApi } from "../services/chat-api";
import { useChatStore } from "../stores/chatStore";
import type { DbMessage, Message, ThoughtStep } from "../types";
import { useChatStream } from "./useChatStream";
import { useModels } from "./useModels";
import { useSessions } from "./useSessions";

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
          let parsed = { toolName: "", toolInput: {} };
          try {
            parsed = JSON.parse(m.content);
          } catch {}
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
  const { models } = useModels();
  const { isAuthenticated } = useAuth();
  const settingsConfig = useSettingsStore((s) => s.config);
  const isLoading = useChatStore((s) => s.isLoading);
  const setMessages = useChatStore((s) => s.setMessages);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const setMode = useChatStore((s) => s.setMode);
  const setSelectedFeatures = useChatStore((s) => s.setSelectedFeatures);

  const { sendMessage, stopStream, clearMessages, recoverMission } = useChatStream();

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

  // While a recovered session's DB snapshot is still stale (status interrupted
  // — local mode, or saas before the relay persists), the store holds the
  // recovered content and must not be clobbered by the snapshot rebuild.
  // Cleared once the snapshot catches up or the session changes.
  const recoveredSessionId = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;

    const sid = useChatStore.getState().activeSessionId;

    // Switching sessions clears the store; the suppression only applies to the
    // session that actually recovered. A new active session always rebuilds.
    if (recoveredSessionId.current !== sid) {
      recoveredSessionId.current = null;
    }

    const snapshotHasIncompleteAssistant = flattenedMessages.some(
      (m) => m.role === "assistant" && (m.status === "streaming" || m.status === "interrupted"),
    );

    if (recoveredSessionId.current === sid && snapshotHasIncompleteAssistant) {
      return;
    }
    if (recoveredSessionId.current === sid) {
      recoveredSessionId.current = null;
    }

    const sorted = [...flattenedMessages].sort((a, b) => {
      if (a.turn_number !== b.turn_number) {
        return a.turn_number - b.turn_number;
      }
      return a.id - b.id;
    });

    const rebuilt = groupMessagesByTurn(sorted);

    // Keep the store's last-message identity when the DB snapshot matches it,
    // so the streaming -> complete transition does not remount MessageItem and
    // replay the token blur-in. Only applies when content, steps, and status
    // are identical, so stale snapshots still rebuild normally.
    const storeMessages = useChatStore.getState().messages;
    if (rebuilt.length > 0 && storeMessages.length > 0) {
      const lastStore = storeMessages[storeMessages.length - 1];
      const lastRebuilt = rebuilt[rebuilt.length - 1];
      if (
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

  // Re-attach to an in-flight mission after page refresh: the gateway treats
  // missionId as the session id, so recovery replays missed packets from the
  // Redis-backed mission stream (cursor = last seen stream id in localStorage).
  const recoveryTriggered = useRef<string | null>(null);

  useEffect(() => {
    if (flattenedMessages.length === 0 || isLoading) return;
    const sid = useChatStore.getState().activeSessionId;
    if (!sid) return;

    const hasIncompleteAssistant = flattenedMessages.some(
      (m) => m.role === "assistant" && (m.status === "streaming" || m.status === "interrupted"),
    );
    if (!hasIncompleteAssistant) return;
    if (recoveryTriggered.current === sid) return;

    recoveryTriggered.current = sid;
    recoveredSessionId.current = sid;
    recoverMission(sid);
  }, [flattenedMessages, isLoading, recoverMission]);

  useEffect(() => {
    const defaultModel = settingsConfig.defaultModel;
    const matchedModel = models.find(
      (m) =>
        m.id === defaultModel ||
        m.name === defaultModel ||
        (defaultModel && m.id.endsWith(`/${defaultModel}`)) ||
        defaultModel?.endsWith(`/${m.name}`),
    );

    const initialModel = matchedModel ? matchedModel.id : models.length > 0 ? models[0].id : defaultModel || "";

    if (initialModel) {
      setSelectedModel(initialModel);
    }
    setMode(settingsConfig.defaultMode || CHAT_MODES.STANDARD);
    setSelectedFeatures(settingsConfig.defaultFeatures);
  }, [settingsConfig, models, setSelectedModel, setMode, setSelectedFeatures]);

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
