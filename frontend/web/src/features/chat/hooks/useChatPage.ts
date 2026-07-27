"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "../stores/chatStore";
import { useModels } from "./useModels";
import { useChatStream } from "./useChatStream";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useSessions } from "./useSessions";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { sessionApi } from "../services/chat-api";
import { CHAT_MODES } from "../constants";
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
    const assistantMsg = group.find(m => m.role === "assistant");
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
    } else if (assistantMsg) {
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
    const hasContent = Boolean(assistantMsg?.content || hasSteps || assistantMsg?.status === "streaming" || assistantMsg?.status === "interrupted");
    if (hasContent) {
      result.push({
        id: crypto.randomUUID(),
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
  const setSessions = useChatStore((s) => s.setSessions);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setMessages = useChatStore((s) => s.setMessages);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const setMode = useChatStore((s) => s.setMode);
  const setSelectedFeatures = useChatStore((s) => s.setSelectedFeatures);

  const { sendMessage, stopStream, clearMessages } = useChatStream();
  const queryClient = useQueryClient();

  const { data: sessionsList } = useQuery({
    queryKey: ["sessions"],
    queryFn: sessionApi.list,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  const activeSessionId = useChatStore((s) => s.activeSessionId);

  const { data: messagesData } = useQuery({
    queryKey: ["sessions", activeSessionId, "messages"],
    queryFn: () => sessionApi.getMessages(activeSessionId!),
    enabled: !!activeSessionId && isAuthenticated,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!sessionsList || sessionsList.length === 0) return;
    setSessions(sessionsList);
    const currentId = useChatStore.getState().activeSessionId;
    if (!currentId || !sessionsList.some((s) => s.id === currentId)) {
      setActiveSession(sessionsList[0].id);
    }
  }, [sessionsList, setSessions, setActiveSession]);

  const initialised = useRef(false);

  useEffect(() => {
    if (initialised.current) return;
    if (sessionsList && sessionsList.length === 0) {
      initialised.current = true;
      sessionApi.create().then((session) => {
        setSessions([session]);
        setActiveSession(session.id);
        clearMessages();
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      }).catch((err) => {
        console.error("[Chat] Failed to create initial session:", err);
        initialised.current = false;
      });
    }
  }, [sessionsList, setSessions, setActiveSession, clearMessages]);

  useEffect(() => {
    if (!messagesData) return;
    setMessages(groupMessagesByTurn(messagesData));
  }, [messagesData, setMessages]);

  useEffect(() => {
    const defaultModel = settingsConfig.defaultModel;
    const matchedModel = models.find(
      (m) =>
        m.id === defaultModel ||
        m.name === defaultModel ||
        (defaultModel && m.id.endsWith(`/${defaultModel}`)) ||
        (defaultModel && defaultModel.endsWith(`/${m.name}`))
    );

    const initialModel = matchedModel
      ? matchedModel.id
      : models.length > 0
      ? models[0].id
      : defaultModel || "";

    if (initialModel) {
      setSelectedModel(initialModel);
    }
    setMode(settingsConfig.defaultMode || CHAT_MODES.STANDARD);
    const defaultFeatures = settingsConfig.defaultFeatures.length > 0
      ? settingsConfig.defaultFeatures
      : ["web_search", "write_todos"];
    setSelectedFeatures(defaultFeatures);
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
  };
}
