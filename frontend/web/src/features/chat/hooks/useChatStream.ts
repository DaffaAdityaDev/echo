"use client";

import { useRef } from "react";
import { api } from "@/lib/api-client";
import { Message, StreamPacket, HistoryMessage, MissionMeta } from "../types";
import { CHAT_ROLES, PACKET_TYPES, CHAT_ENDPOINTS } from "../constants";
import { useChatStore } from "../stores/chatStore";
import { sessionApi } from "../services/chat-api";

export function useChatStream() {
  const {
    isLoading,
    setMessages,
    setIsLoading,
    setAgentProgress,
    setAgentState,
    clearMessages,
    appendPacketLog,
    appendDebugInfo,
    setCumulativeUsage,
    setMissionMeta,
  } = useChatStore();

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
        ...currentMessages.filter((m) => m.content.trim().length > 0).map((m) => ({
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

      await api.stream(
        CHAT_ENDPOINTS.STREAM,
        payload,
        (data: StreamPacket) => {
          const store = useChatStore.getState();

          // 1. Universal Packet Capture to Ring Buffer Log
          store.appendPacketLog(data);

          const currentMsgs = store.messages;
          if (currentMsgs.length === 0) return;

          const lastIdx = currentMsgs.length - 1;
          const lastMessage = {
            ...currentMsgs[lastIdx],
            steps: [...(currentMsgs[lastIdx].steps || [])],
          };

        // 2. Telemetry Packet Dispatching
        if (data.type === PACKET_TYPES.METADATA) {
          const meta: MissionMeta = data.meta || {
            strategy: data.strategy,
            historyDepth: data.historyDepth,
            toolsAvailable: data.toolsAvailable,
            objective: data.objective,
            maxIterations: data.maxIterations,
          };
          lastMessage.meta = meta;
          store.setMissionMeta(meta);

          // Auto-title: update store title & session list when title packet arrives
          if (data.title) {
            const sid = store.activeSessionId;
            if (sid) {
              const currentSessions = store.sessions;
              const newTitle = data.title;
              const newSummary = data.summary;
              const updated = currentSessions.map((s) =>
                s.id === sid ? { ...s, title: newTitle, contextSummary: newSummary || s.contextSummary } : s
              );
              store.setSessions(updated);
            }
          }
        } else if (data.type === PACKET_TYPES.DEBUG) {
          store.appendDebugInfo({
            systemPrompt: data.rawSystemPrompt,
            historyLength: data.currentHistoryLength,
            rawMessages: data.rawMessages,
            missionId: data.missionId,
            timestamp: data.timestamp,
          });
        } else if (data.type === PACKET_TYPES.USAGE) {
          if (data.usage) {
            lastMessage.usage = data.usage;
            store.setCumulativeUsage(data.usage);
          }
        } else if (data.type === PACKET_TYPES.REASONING) {
          const reasoningText = data.content || "";
          if (reasoningText) {
            const lastStep = lastMessage.steps[lastMessage.steps.length - 1];
            if (lastStep?.type === PACKET_TYPES.REASONING) {
              lastMessage.steps[lastMessage.steps.length - 1] = {
                ...lastStep,
                content: (lastStep.content || "") + reasoningText,
              };
            } else {
              lastMessage.steps.push({ type: PACKET_TYPES.REASONING, content: reasoningText });
            }
          }
        } else if (data.type === PACKET_TYPES.TOOL_CALL) {
          lastMessage.steps.push({
            type: PACKET_TYPES.TOOL_CALL,
            toolName: data.toolName,
            toolInput: data.toolInput,
          });
        } else if (data.type === PACKET_TYPES.TOOL_RESULT) {
          lastMessage.steps.push({
            type: PACKET_TYPES.TOOL_RESULT,
            toolName: data.toolName,
            content: data.content,
          });
        } else if (data.type === PACKET_TYPES.TODO) {
          lastMessage.steps.push({
            type: PACKET_TYPES.TODO,
            todos: data.todos,
          });
        } else if (data.type === PACKET_TYPES.SUBAGENT_CALL) {
          lastMessage.steps.push({
            type: PACKET_TYPES.SUBAGENT_CALL,
            subagent: data.subagent,
          });
        } else if (data.type === PACKET_TYPES.SUBAGENT_RESULT) {
          lastMessage.steps.push({
            type: PACKET_TYPES.SUBAGENT_RESULT,
            subagent: data.subagent,
          });
        } else if (data.type === PACKET_TYPES.FILE_OPERATION) {
          lastMessage.steps.push({
            type: PACKET_TYPES.FILE_OPERATION,
            fileOp: data.fileOp,
          });
        } else if (data.type === PACKET_TYPES.SWARM_STATUS) {
          if (data.swarm) {
            store.setAgentProgress((prev) => {
              const currentSwarm = prev?.swarm || {
                activeUrls: {} as NonNullable<NonNullable<typeof prev>["swarm"]>["activeUrls"],
                scrapedCount: 0,
                failedCount: 0,
                factsCount: 0,
                discoveredCount: 0,
                discoveredUrls: [],
              };

              const updatedActiveUrls = { ...currentSwarm.activeUrls };
              if (data.swarm?.url) {
                const existing = updatedActiveUrls[data.swarm.url];
                updatedActiveUrls[data.swarm.url] = {
                  url: data.swarm.url,
                  status: data.swarm.status,
                  attempt: data.swarm.attempt || existing?.attempt || 1,
                  feedback: data.swarm.feedback || existing?.feedback,
                  dataSize: data.swarm.dataSize || existing?.dataSize,
                  factsCount: data.swarm.factsCount || existing?.factsCount,
                };
              }

              let newScraped = currentSwarm.scrapedCount;
              let newFailed = currentSwarm.failedCount;
              let newFacts = currentSwarm.factsCount;

              if (data.swarm?.status === "critic_passed" && data.swarm?.url) {
                if (currentSwarm.activeUrls[data.swarm.url]?.status !== "critic_passed") {
                  newScraped += 1;
                }
                if (data.swarm.factsCount) {
                  newFacts += data.swarm.factsCount;
                }
              } else if (data.swarm?.status === "scrape_failed" && data.swarm?.url) {
                if (currentSwarm.activeUrls[data.swarm.url]?.status !== "scrape_failed") {
                  newFailed += 1;
                }
              }

              const newDiscoveredUrls = [...(currentSwarm.discoveredUrls || [])];
              if (data.swarm?.url && !newDiscoveredUrls.includes(data.swarm.url)) {
                newDiscoveredUrls.push(data.swarm.url);
              }

              return {
                iteration: prev?.iteration || 0,
                totalIterations: prev?.totalIterations || 0,
                currentTool: data.swarm?.status === "crawling" ? `crawling ${data.swarm?.url}` : undefined,
                statusMessage: data.swarm?.message,
                swarm: {
                  status: data.swarm?.status,
                  url: data.swarm?.url,
                  activeUrls: updatedActiveUrls,
                  scrapedCount: newScraped,
                  failedCount: newFailed,
                  factsCount: newFacts,
                  discoveredCount: Math.max(currentSwarm.discoveredCount, newDiscoveredUrls.length),
                  discoveredUrls: newDiscoveredUrls,
                },
              };
            });
          }
          lastMessage.steps.push({
            type: PACKET_TYPES.SWARM_STATUS,
            swarm: data.swarm,
          });
        } else if (data.type === PACKET_TYPES.HEARTBEAT) {
          if (data.agentStatus) {
            store.setAgentProgress((prev) =>
              prev
                ? { ...prev, agentStatus: data.agentStatus }
                : { iteration: 0, totalIterations: 0, agentStatus: data.agentStatus }
            );
          }
        } else if (data.type === PACKET_TYPES.STATE_CHANGE) {
          const nextState = (data.to || data.agentStatus?.state) as any;
          if (nextState) {
            store.setAgentState(nextState);
            lastMessage.steps.push({
              type: "state_change",
              content: `State changed to ${nextState}`,
            });
          }
        } else if (data.type === PACKET_TYPES.DEGRADED) {
          store.setAgentState("degraded");
          lastMessage.steps.push({
            type: "state_change",
            content: data.reason || "Agent is in degraded state",
          });
        } else if (data.type === PACKET_TYPES.TOOL_SKIP) {
          lastMessage.steps.push({ type: "tool_skip", toolName: data.toolName, content: "Skipped (circuit open)" });
        } else if (data.type === PACKET_TYPES.PROGRESS) {
          if (typeof data.step === "number") {
            const step = data.step;
            store.setAgentProgress((prev) =>
              prev ? { ...prev, iteration: step } : { iteration: step, totalIterations: 0 }
            );
          }
        } else if (data.type === PACKET_TYPES.TURN_COMPLETE) {
          if (data.usage) {
            lastMessage.usage = data.usage;
            store.setCumulativeUsage(data.usage);
          }
          store.setAgentState("completed");
        } else if (data.type === PACKET_TYPES.ERROR) {
          lastMessage.content = `Error: ${data.content || "Stream execution failed"}`;
          store.setAgentState("error");
        } else {
          const streamRecord = data as unknown as { choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>; content?: string; reasoning_content?: string };
          const delta = streamRecord.choices?.[0]?.delta || streamRecord;
          const content = delta.content || "";
          const reasoning = delta.reasoning_content || "";

          if (reasoning) {
            const lastStep = lastMessage.steps[lastMessage.steps.length - 1];
            if (lastStep?.type === PACKET_TYPES.REASONING) {
              lastMessage.steps[lastMessage.steps.length - 1] = {
                ...lastStep,
                content: (lastStep.content || "") + reasoning,
              };
            } else {
              lastMessage.steps.push({ type: PACKET_TYPES.REASONING, content: reasoning });
            }
          }
          if (content) {
            lastMessage.content = (lastMessage.content || "") + content;
          }
        }

        const nextMsgs = [...currentMsgs];
        nextMsgs[nextMsgs.length - 1] = lastMessage;
        store.setMessages(nextMsgs);
      }, { signal: abortRef.current.signal });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Chat error:", err);
      const store = useChatStore.getState();
      store.setAgentState("error");
      const currentMsgs = store.messages;
      if (currentMsgs.length === 0) return;
      const lastIdx = currentMsgs.length - 1;
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch response from agent.";
      const lastMessage = {
        ...currentMsgs[lastIdx],
        content: `Error: ${errorMessage}`,
      };
      store.setMessages([...currentMsgs.slice(0, -1), lastMessage]);
    } finally {
      setIsLoading(false);
      setAgentProgress(null);

      const state = useChatStore.getState();
      const sid = state.activeSessionId;

      // Auto-generate title asynchronously if session exists and still has default title
      if (sid && state.selectedModel) {
        const activeSess = state.sessions.find((s) => s.id === sid);
        if (!activeSess?.title || activeSess.title === "New Chat") {
          sessionApi.generateTitle(sid, state.selectedModel).catch(() => {});
        }
      }

      sessionApi
        .list()
        .then((sessions) => useChatStore.getState().setSessions(sessions))
        .catch(() => {});
    }
  };

  const stopStream = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      setIsLoading(false);
      setAgentProgress(null);
      useChatStore.getState().setAgentState("aborted");
    }
  };

  const handleClearMessages = () => {
    stopStream();
    clearMessages();
  };

  return {
    sendMessage,
    stopStream,
    isLoading,
    clearMessages: handleClearMessages,
  };
}
