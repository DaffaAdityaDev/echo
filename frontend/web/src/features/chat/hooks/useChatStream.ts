"use client";

import { useRef } from "react";
import { api } from "@/lib/api-client";
import { Message, StreamPacket, HistoryMessage, MissionMeta, TokenUsage, FailedUrl } from "../types";
import { CHAT_ROLES, PACKET_TYPES, CHAT_ENDPOINTS } from "../constants";
import { useChatStore } from "../stores/chatStore";
import { sessionApi } from "../services/chat-api";

export function useChatStream() {
  const { isLoading, setMessages, setIsLoading, setAgentProgress, clearMessages } = useChatStore();
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
        ...currentMessages.filter(m => m.content.trim().length > 0).map(m => ({ role: m.role, content: m.content })),
        { role: CHAT_ROLES.USER, content: input }
      ];

      const activeMissionId = [...currentMessages]
        .reverse()
        .find(m => m.role === CHAT_ROLES.ASSISTANT && m.meta?.missionId)
        ?.meta?.missionId;

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);
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
        features: storeState.selectedFeatures
      };
      if (storeState.selectedModel) payload.model = storeState.selectedModel;

      await api.stream<StreamPacket>(CHAT_ENDPOINTS.STREAM, payload, (data) => {
        const store = useChatStore.getState();
        const currentMsgs = store.messages;
        if (currentMsgs.length === 0) return;
        const lastIdx = currentMsgs.length - 1;
        const lastMessage = { ...currentMsgs[lastIdx], steps: [...currentMsgs[lastIdx].steps] };

        const isSubAgentPacket = data.missionId && lastMessage.meta?.missionId && data.missionId !== lastMessage.meta?.missionId;

        if (isSubAgentPacket) {
          if (data.content) {
            lastMessage.content = (lastMessage.content || "") + `\n\n_[Sub-agent ${data.missionId}]: ${data.content}_`;
          }
          if (data.type === PACKET_TYPES.TOOL_RESULT && data.content) {
            lastMessage.steps.push({ type: PACKET_TYPES.TOOL_RESULT, toolName: data.toolName, content: `[Sub-agent ${data.missionId}]: ${data.content}` });
          }
          store.setMessages([...currentMsgs.slice(0, -1), lastMessage]);
          return;
        }

        if (data.type === PACKET_TYPES.METADATA) {
          if (data.meta) {
            lastMessage.meta = data.meta as MissionMeta;
            const metaObj = data.meta as Record<string, unknown>;
            const maxIter = metaObj?.maxIterations;
            if (typeof maxIter === 'number') {
              store.setAgentProgress(prev => prev ? { ...prev, totalIterations: maxIter } : { iteration: 1, totalIterations: maxIter });
            }
          }
          if (data.content) {
            store.setAgentProgress(prev => {
              if (!prev) return { iteration: 1, totalIterations: 0, statusMessage: data.content };
              return { ...prev, statusMessage: data.content };
            });
          }
        } else if (data.type === PACKET_TYPES.USAGE && data.meta) {
          lastMessage.usage = data.meta as TokenUsage;
        } else if (data.type === PACKET_TYPES.CONTENT && data.content) {
          lastMessage.content = (lastMessage.content || "") + data.content;
        } else if (data.type === PACKET_TYPES.REASONING && data.content) {
          const lastStep = lastMessage.steps[lastMessage.steps.length - 1];
          if (lastStep?.type === PACKET_TYPES.REASONING) {
            lastMessage.steps[lastMessage.steps.length - 1] = {
              ...lastStep,
              content: (lastStep.content || "") + data.content
            };
          } else {
            lastMessage.steps.push({ type: PACKET_TYPES.REASONING, content: data.content });
          }
        } else if (data.type === PACKET_TYPES.TOOL_CALL) {
          store.setAgentProgress(prev => {
            if (!prev) {
              return { iteration: 1, totalIterations: 0, currentTool: data.toolName };
            }
            return { 
              ...prev, 
              iteration: prev.totalIterations > 0 ? Math.min(prev.iteration + 1, prev.totalIterations) : prev.iteration + 1, 
              currentTool: data.toolName 
            };
          });
          lastMessage.steps.push({
            type: PACKET_TYPES.TOOL_CALL,
            toolName: data.toolName,
            toolInput: data.toolInput
          });
        } else if (data.type === PACKET_TYPES.TOOL_RESULT) {
          store.setAgentProgress(prev => {
            if (!prev) return null;
            const nextProgress = { ...prev, currentTool: undefined };
            const tr = data.toolResult as { failedUrls?: FailedUrl[] } | undefined;
            if (tr?.failedUrls && nextProgress.swarm) {
              nextProgress.swarm = {
                ...nextProgress.swarm,
                failedUrls: tr.failedUrls,
                failedCount: tr.failedUrls.length
              };
            }
            return nextProgress;
          });
          lastMessage.steps.push({
            type: PACKET_TYPES.TOOL_RESULT,
            toolName: data.toolName,
            content: data.content
          });
        } else if (data.type === PACKET_TYPES.TODO) {
          const todosArray = Array.isArray(data.todos)
            ? data.todos
            : data.todos
            ? [data.todos]
            : [];
          lastMessage.steps.push({
            type: PACKET_TYPES.TODO,
            todos: todosArray
          });
        } else if (data.type === PACKET_TYPES.SUBAGENT_CALL) {
          lastMessage.steps.push({
            type: PACKET_TYPES.SUBAGENT_CALL,
            subagent: data.subagent
          });
        } else if (data.type === PACKET_TYPES.SUBAGENT_RESULT) {
          lastMessage.steps.push({
            type: PACKET_TYPES.SUBAGENT_RESULT,
            subagent: data.subagent
          });
        } else if (data.type === PACKET_TYPES.FILE_OPERATION) {
          lastMessage.steps.push({
            type: PACKET_TYPES.FILE_OPERATION,
            fileOp: data.fileOp
          });
        } else if (data.type === PACKET_TYPES.SWARM_STATUS) {
          if (data.swarm) {
            store.setAgentProgress(prev => {
              if (!prev) {
                return { iteration: 1, totalIterations: 0, swarm: undefined };
              }
              const swarm = prev.swarm || { scrapedCount: 0, failedCount: 0, factsCount: 0, discoveredCount: 0, failedUrls: [], activeUrls: {} };
              const activeUrls = { ...swarm.activeUrls };
              const s = data.swarm!;
              
              if (s.url) {
                const existing = activeUrls[s.url] || { url: s.url, status: '', factsCount: 0, dataSize: 0 };
                const newStatus = s.status;
                const factsCount = s.factsCount ?? existing.factsCount;
                const dataSize = s.dataSize ?? existing.dataSize;
                let attempt = existing.attempt ?? 0;
                if (s.status === 'critic_failed') {
                  attempt = attempt + 1;
                }
                
                activeUrls[s.url] = {
                  ...existing,
                  status: newStatus,
                  factsCount,
                  dataSize,
                  attempt,
                  feedback: s.feedback ?? existing.feedback
                };
              }
              
              let scraped = 0;
              let failed = 0;
              let facts = 0;
              const failedUrls = [...swarm.failedUrls];
              
              Object.values(activeUrls).forEach(item => {
                if (item.status === 'critic_passed') {
                  scraped += 1;
                  facts += item.factsCount || 0;
                } else if (item.status === 'scrape_failed') {
                  failed += 1;
                  if (!failedUrls.some(f => f.url === item.url)) {
                    failedUrls.push({ url: item.url, reason: item.feedback || 'unreachable or blocked' });
                  }
                }
              });
              
              return {
                ...prev,
                swarm: {
                  scrapedCount: scraped,
                  failedCount: failed,
                  factsCount: facts,
                  discoveredCount: Object.keys(activeUrls).length,
                  status: s.status,
                  url: s.url || swarm.url,
                  depth: s.depth ?? swarm.depth,
                  failedUrls,
                  activeUrls
                }
              };
            });
          }
          lastMessage.steps.push({
            type: PACKET_TYPES.SWARM_STATUS,
            swarm: data.swarm
          });
        } else if (data.type === PACKET_TYPES.HEARTBEAT) {
          if (data.agentStatus) {
            store.setAgentProgress(prev => prev ? { ...prev, agentStatus: data.agentStatus } : { iteration: 0, totalIterations: 0, agentStatus: data.agentStatus });
          }
        } else if (data.type === PACKET_TYPES.STATE_CHANGE) {
          if (data.agentStatus) {
            store.setAgentState(data.agentStatus.state);
            lastMessage.steps.push({ type: 'state_change', content: `State changed to ${data.agentStatus.state}` });
          }
        } else if (data.type === PACKET_TYPES.DEGRADED) {
          store.setAgentState('degraded');
          lastMessage.steps.push({ type: 'state_change', content: data.content || 'Agent is in degraded state' });
        } else if (data.type === PACKET_TYPES.TOOL_SKIP) {
          lastMessage.steps.push({ type: 'tool_skip', toolName: data.toolName, content: 'Skipped (circuit open)' });
        } else if (data.type === PACKET_TYPES.PROGRESS) {
          if (typeof data.step === 'number') {
            const step = data.step;
            store.setAgentProgress(prev => prev ? { ...prev, iteration: step } : { iteration: step, totalIterations: 0 });
          }
        } else if (data.type === PACKET_TYPES.TURN_COMPLETE) {
          store.setAgentState('completed');
          if (data.turnComplete) {
            lastMessage.usage = {
              promptTokens: data.turnComplete.tokenCount,
              completionTokens: 0,
              totalTokens: data.turnComplete.tokenCount,
            };
          }
        } else if (data.type === PACKET_TYPES.ERROR) {
          // Surface stream-level errors (e.g. provider failure) to the user
          lastMessage.content = `Error: ${data.content || "Stream execution failed"}`;
          store.setAgentState('error');
        } else {
          const delta = (data.choices?.[0]?.delta || data) as StreamPacket & { reasoning_content?: string };
          const content = delta.content || "";
          const reasoning = delta.reasoning_content || "";

          if (reasoning) {
            const lastStep = lastMessage.steps[lastMessage.steps.length - 1];
            if (lastStep?.type === PACKET_TYPES.REASONING) {
              lastMessage.steps[lastMessage.steps.length - 1] = {
                ...lastStep,
                content: (lastStep.content || "") + reasoning
              };
            } else {
              lastMessage.steps.push({ type: PACKET_TYPES.REASONING, content: reasoning });
            }
          }
          if (content) {
            lastMessage.content = (lastMessage.content || "") + content;
          }
        }

        store.setMessages([...currentMsgs.slice(0, -1), lastMessage]);
      }, { signal: abortRef.current.signal });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error("Chat error:", err);
      const store = useChatStore.getState();
      const currentMsgs = store.messages;
      if (currentMsgs.length === 0) return;
      const lastIdx = currentMsgs.length - 1;
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch response from agent.";
      const lastMessage = { 
        ...currentMsgs[lastIdx], 
        content: `Error: ${errorMessage}` 
      };
      store.setMessages([...currentMsgs.slice(0, -1), lastMessage]);
    } finally {
      setIsLoading(false);
      setAgentProgress(null);
      sessionApi.list().then(sessions => useChatStore.getState().setSessions(sessions)).catch(() => {});
    }
  };

  const clearAll = () => {
    abortRef.current?.abort();
    clearMessages();
  };

  return {
    sendMessage,
    clearMessages: clearAll,
  };
}
