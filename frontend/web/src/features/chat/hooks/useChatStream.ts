"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { api } from "@/lib/api-client";
import { CHAT_ENDPOINTS, CHAT_ROLES, PACKET_TYPES } from "../constants";
import { applyStreamPacket } from "../services/applyStreamPacket";
import { missionApi, sessionApi } from "../services/chat-api";
import { clearMissionCursor, getMissionCursor, setMissionCursor } from "../services/mission-cursor";
import { useChatStore } from "../stores/chatStore";
import type { HistoryMessage, Message, StreamPacket } from "../types";

const TERMINAL_PACKETS = new Set<string>([
  PACKET_TYPES.TURN_COMPLETE,
  PACKET_TYPES.MISSION_COMPLETED,
  PACKET_TYPES.ERROR,
]);

async function generateSessionTitle(sid: string): Promise<void> {
  const state = useChatStore.getState();
  const model = state.selectedModel;
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
  const { isLoading, setMessages, setIsLoading, setAgentProgress, setAgentState, clearMessages } = useChatStore();
  const queryClient = useQueryClient();

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
    };

    try {
      const currentMessages = useChatStore.getState().messages;
      const history: HistoryMessage[] = [
        ...currentMessages
          .filter((m) => m.content.trim().length > 0)
          .map((m) => ({
            role: m.role,
            content: m.content,
          })),
        { role: CHAT_ROLES.USER, content: input },
      ];

      const activeMissionId = currentMessages
        .slice()
        .reverse()
        .find((m) => m.role === CHAT_ROLES.ASSISTANT && m.meta?.missionId)?.meta?.missionId;

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);
      setAgentState("running");
      setAgentProgress({
        iteration: 0,
        totalIterations: 0,
      });

      abortRef.current = new AbortController();

      const storeState = useChatStore.getState();
      const settingsState = useSettingsStore.getState();
      const payload: Record<string, unknown> = {
        message: input,
        mode: storeState.mode,
        missionId: activeMissionId,
        sessionId: storeState.activeSessionId || undefined,
        history,
        features: storeState.selectedFeatures,
      };

      if (storeState.selectedModel) {
        payload.model = storeState.selectedModel;
      }

      if (settingsState.config.harnessToggles) {
        payload.config = { featureToggles: settingsState.config.harnessToggles };
      }

      await api.stream(
        CHAT_ENDPOINTS.STREAM,
        payload,
        (data: StreamPacket) => {
          if (data.type === PACKET_TYPES.REPLAY_DONE) return;
          if (data.missionId && typeof data.sid === "string") {
            setMissionCursor(data.missionId, data.sid);
            if (TERMINAL_PACKETS.has(data.type)) {
              clearMissionCursor(data.missionId);
            }
          }
          applyStreamPacket(data);
        },
        { signal: abortRef.current.signal },
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Chat error:", err);
      const store = useChatStore.getState();
      store.setAgentState("error");
      const currentMsgs = store.messages;
      if (currentMsgs.length === 0) return;
      const lastIdx = currentMsgs.length - 1;
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch response from agent.";
      const prevContent = currentMsgs[lastIdx]?.content || "";
      const updatedContent = prevContent ? `${prevContent}\n\n[Error: ${errorMessage}]` : `Error: ${errorMessage}`;
      const lastMessage = {
        ...currentMsgs[lastIdx],
        content: updatedContent,
      };
      store.setMessages([...currentMsgs.slice(0, -1), lastMessage]);
    } finally {
      const sid = useChatStore.getState().activeSessionId;
      if (sid) {
        try {
          await queryClient.invalidateQueries({ queryKey: ["sessions", sid, "messages"] });
        } catch (err) {
          console.warn("[Chat] Failed to invalidate messages query:", err);
        }
      }

      setIsLoading(false);
      setAgentProgress(null);

      // Auto-generate title if still default, then refresh the session list.
      generateSessionTitle(sid || "")
        .then(() => sessionApi.list().then((res) => useChatStore.getState().setSessions(res.sessions)))
        .catch((err) => {
          console.warn("[Chat] Failed to refresh sessions:", err);
        });
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

  const recoverMission = async (missionId: string) => {
    const store = useChatStore.getState();
    if (store.isLoading) return;
    if (!missionId) return;

    const cursor = getMissionCursor(missionId);
    setIsLoading(true);
    setAgentState("running");
    abortRef.current = new AbortController();

    // Replayed history is already represented in the message rebuilt from the
    // DB, so content/reasoning deltas are skipped while replaying. The stream
    // emits a replay_done marker once the live phase begins; after it, content
    // and reasoning are applied normally so a recovered mission keeps streaming.
    let replay = true;

    try {
      await missionApi.getStream(
        missionId,
        cursor,
        (data: StreamPacket) => {
          if (data.type === PACKET_TYPES.REPLAY_DONE) {
            replay = false;
            return;
          }
          if (typeof data.sid === "string") {
            setMissionCursor(missionId, data.sid);
            if (TERMINAL_PACKETS.has(data.type)) {
              clearMissionCursor(missionId);
            }
          }
          applyStreamPacket(data, { replay });
        },
        abortRef.current.signal,
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.warn("[Chat] Mission stream recovery failed:", err);
      useChatStore.getState().setAgentState("error");
    } finally {
      // Refresh the message snapshot so the recovery result lands in the DB
      // query (in saas mode the gateway persists the recovered completion).
      // The await keeps isLoading true until the refetch settles, so the
      // snapshot-rebuild effect in useChatPage runs against fresh data.
      const recoveredSid = useChatStore.getState().activeSessionId || missionId;
      try {
        await queryClient.invalidateQueries({ queryKey: ["sessions", recoveredSid, "messages"] });
      } catch (err) {
        console.warn("[Chat] Failed to invalidate messages query after recovery:", err);
      }

      setIsLoading(false);
      setAgentProgress(null);
      abortRef.current = null;
      // The gateway treats missionId as the session id — generate the title
      // for a session recovered after refresh so it never stays "New Chat".
      void generateSessionTitle(missionId);
    }
  };

  const handleClearMessages = () => {
    stopStream();
    clearMessages();
  };

  return {
    sendMessage,
    stopStream,
    recoverMission,
    isLoading,
    clearMessages: handleClearMessages,
  };
}
