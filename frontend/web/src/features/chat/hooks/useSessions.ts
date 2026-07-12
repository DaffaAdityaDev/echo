import { useCallback } from "react";
import { useChatStore } from "../stores/chatStore";
import { sessionApi } from "../services/chat-api";
import type { DbMessage, Message } from "../types";

function dbMessageToMessage(dbm: DbMessage): Message {
  if (dbm.role === "thought") {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      steps: [{ type: "reasoning", content: dbm.content }],
    };
  }
  if (dbm.role === "tool_call") {
    let parsed = { toolName: "", toolInput: {} };
    try { parsed = JSON.parse(dbm.content) } catch {}
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      steps: [{ type: "tool_call", toolName: parsed.toolName, toolInput: parsed.toolInput }],
    };
  }
  if (dbm.role === "system") {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `[System]: ${dbm.content}`,
      steps: [],
    };
  }
  if (dbm.role === "tool_result") {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      steps: [{ type: "tool_result", content: dbm.content }],
    };
  }
  const role = dbm.role === "user" ? "user" : "assistant";
  return { id: crypto.randomUUID(), role, content: dbm.content, steps: [] };
}

export function useSessions() {
  const { sessions, activeSessionId, setSessions, setActiveSession, clearMessages, setMessages } = useChatStore();

  const loadSessionMessages = useCallback(async (id: string) => {
    try {
      const dbMessages = await sessionApi.getMessages(id);
      const formatted = dbMessages.map(dbMessageToMessage);
      return formatted;
    } catch (e) {
      console.error("Failed to load session messages:", e);
      return [];
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const list = await sessionApi.list();
      setSessions(list);
      
      const storeState = useChatStore.getState();
      if (!storeState.activeSessionId) {
        if (list.length > 0) {
          const mostRecent = list[0].id;
          setActiveSession(mostRecent);
          const msgs = await loadSessionMessages(mostRecent);
          setMessages(msgs);
        } else {
          const session = await sessionApi.create();
          setSessions([session]);
          setActiveSession(session.id);
          clearMessages();
        }
      }
    } catch (e) {
      console.error("Failed to load sessions:", e);
    }
  }, [setSessions, setActiveSession, loadSessionMessages, setMessages, clearMessages]);

  const createSession = useCallback(async () => {
    const session = await sessionApi.create();
    setSessions([session, ...sessions]);
    setActiveSession(session.id);
    clearMessages();
    return session;
  }, [sessions, setSessions, setActiveSession, clearMessages]);

  const deleteSession = useCallback(async (id: string) => {
    // Optimistic update: remove session from state immediately
    setSessions(sessions.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSession(null);
      clearMessages();
    }
    try {
      await sessionApi.delete(id);
    } catch (e) {
      console.error("Failed to delete session on backend:", e);
    }
  }, [sessions, activeSessionId, setSessions, setActiveSession, clearMessages]);

  const selectSession = useCallback(async (id: string) => {
    setActiveSession(id);
    const msgs = await loadSessionMessages(id);
    setMessages(msgs);
  }, [setActiveSession, loadSessionMessages, setMessages]);

  return { sessions, activeSessionId, loadSessions, loadSessionMessages, createSession, deleteSession, selectSession };
}
