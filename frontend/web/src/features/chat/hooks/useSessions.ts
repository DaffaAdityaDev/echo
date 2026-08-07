import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { CHAT_QUERY_KEYS } from "../constants";
import { sessionApi } from "../services/chat-api";
import { useChatStore } from "../stores/chatStore";

export function useSessions() {
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const setSessions = useChatStore((s) => s.setSessions);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setNewChatPending = useChatStore((s) => s.setNewChatPending);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  const createSession = useCallback(() => {
    setActiveSession(null);
    setNewChatPending(true);
    clearMessages();
    if (pathname !== "/") {
      router.push("/");
    }
  }, [setActiveSession, setNewChatPending, clearMessages, router, pathname]);

  const deleteSession = useCallback(
    async (id: string) => {
      setSessions(sessions.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        setActiveSession(null);
        clearMessages();
        if (pathname !== "/") {
          router.push("/");
        }
      }
      try {
        await sessionApi.delete(id);
      } catch (e) {
        console.error("Failed to delete session on backend:", e);
      } finally {
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.sessions, exact: true });
      }
    },
    [sessions, activeSessionId, setSessions, setActiveSession, clearMessages, queryClient, router, pathname],
  );

  const selectSession = useCallback(
    async (id: string) => {
      setNewChatPending(false);
      setActiveSession(id);
    },
    [setNewChatPending, setActiveSession],
  );

  return { sessions, activeSessionId, createSession, deleteSession, selectSession };
}
