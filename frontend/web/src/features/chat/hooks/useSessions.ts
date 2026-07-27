import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "../stores/chatStore";
import { sessionApi } from "../services/chat-api";

export function useSessions() {
  const { sessions, activeSessionId, setSessions, setActiveSession, clearMessages, setMessages } = useChatStore();
  const queryClient = useQueryClient();

  const createSession = useCallback(async () => {
    const session = await sessionApi.create();
    setSessions([session, ...sessions]);
    setActiveSession(session.id);
    clearMessages();
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    return session;
  }, [sessions, setSessions, setActiveSession, clearMessages, queryClient]);

  const deleteSession = useCallback(async (id: string) => {
    setSessions(sessions.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSession(null);
      clearMessages();
    }
    try {
      await sessionApi.delete(id);
    } catch (e) {
      console.error("Failed to delete session on backend:", e);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    }
  }, [sessions, activeSessionId, setSessions, setActiveSession, clearMessages, queryClient]);

  const selectSession = useCallback(async (id: string) => {
    setActiveSession(id);
  }, [setActiveSession]);

  return { sessions, activeSessionId, createSession, deleteSession, selectSession };
}
