import { useCallback } from "react";
import { useChatStore } from "../stores/chatStore";
import { sessionApi } from "../services/chat-api";
import type { DbMessage, Message, ThoughtStep } from "../types";

function groupMessagesByTurn(messages: DbMessage[]): Message[] {
  const turnMap = new Map<number, DbMessage[]>();
  for (const msg of messages) {
    const group = turnMap.get(msg.turn_number) || [];
    group.push(msg);
    turnMap.set(msg.turn_number, group);
  }

  const result: Message[] = [];
  for (const [, group] of turnMap) {
    const userMsg = group.find(m => m.role === "user");
    const assistantMsg = group.find(m => m.role === "assistant" && m.content);
    const systemMsg = group.find(m => m.role === "system");

    if (systemMsg) {
      result.push({ id: crypto.randomUUID(), role: "assistant", content: `[System]: ${systemMsg.content}`, steps: [] });
      continue;
    }

    if (userMsg) {
      result.push({ id: crypto.randomUUID(), role: "user", content: userMsg.content, steps: [] });
    }

    let steps: ThoughtStep[] = [];
    if (assistantMsg?.steps && assistantMsg.steps.length > 0) {
      steps = assistantMsg.steps;
    } else {
      for (const m of group) {
        if (m.role === "thought") {
          steps.push({ type: "reasoning", content: m.content });
        } else if (m.role === "tool_call") {
          let parsed = { toolName: "", toolInput: {} };
          try { parsed = JSON.parse(m.content) } catch {}
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
    const hasContent = assistantMsg?.content || hasSteps;
    if (hasContent || hasSteps) {
      result.push({
        id: crypto.randomUUID(),
        role: "assistant",
        content: assistantMsg?.content || "",
        steps,
      });
    }
  }

  return result;
}

export function useSessions() {
  const { sessions, activeSessionId, setSessions, setActiveSession, clearMessages, setMessages } = useChatStore();

  const loadSessionMessages = useCallback(async (id: string) => {
    try {
      const dbMessages = await sessionApi.getMessages(id);
      return groupMessagesByTurn(dbMessages);
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
