"use client";

import { useEffect } from "react";
import { useChatStore } from "../stores/chatStore";
import { useModels } from "./useModels";
import { useChatStream } from "./useChatStream";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useSessions } from "./useSessions";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { CHAT_MODES } from "../constants";

export function useChatPage() {
  const { loadSessions, createSession, deleteSession, selectSession } = useSessions();
  const { models } = useModels();
  const { isAuthenticated } = useAuth();
  const settingsConfig = useSettingsStore((s) => s.config);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const setMode = useChatStore((s) => s.setMode);
  const setSelectedFeatures = useChatStore((s) => s.setSelectedFeatures);

  useEffect(() => {
    const defaultModel = settingsConfig.defaultModel;
    const isAvailable = models.some((m) => m.id === defaultModel);
    const initialModel = isAvailable
      ? defaultModel
      : models.length > 0
      ? (models.find((m) => m.id.includes("deepseek") || m.id.includes("flash"))?.id || models[0].id)
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

  const { sendMessage, clearMessages } = useChatStream();

  useEffect(() => {
    if (isAuthenticated) {
      loadSessions();
    }
  }, [isAuthenticated, loadSessions]);

  return {
    sendMessage,
    clearMessages,
    createSession,
    deleteSession,
    selectSession,
  };
}
