"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Message, StreamPacket, HistoryMessage, MissionMeta, TokenUsage, AgentProgress } from "../types";
import { CHAT_ROLES, CHAT_MODES, PACKET_TYPES, CHAT_MESSAGES, CHAT_ENDPOINTS } from "../constants";

export function useChatStream(selectedModel: string, mode: typeof CHAT_MODES[keyof typeof CHAT_MODES] | string, selectedFeatures: string[]) {

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentProgress, setAgentProgress] = useState<AgentProgress | null>(null);

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

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);
    setAgentProgress({
      iteration: 1,
      totalIterations: 0,
    });

    try {
      const history: HistoryMessage[] = messages
        .filter(m => m.content.trim().length > 0)
        .map(m => ({ role: m.role, content: m.content }));

      const activeMissionId = [...messages]
        .reverse()
        .find(m => m.role === CHAT_ROLES.ASSISTANT && m.meta?.missionId)
        ?.meta?.missionId;

      await api.stream<StreamPacket>(CHAT_ENDPOINTS.STREAM, { 
        message: input, 
        model: selectedModel,
        mode: mode,
        missionId: activeMissionId,
        history,
        features: selectedFeatures
      }, (data) => {
        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          const lastMessage = { ...prev[lastIdx], steps: [...prev[lastIdx].steps] };

          const parentMissionId = (data.type === PACKET_TYPES.METADATA && data.meta && (data.meta as any).missionId) || lastMessage.meta?.missionId;
          const isSubAgentPacket = data.missionId && parentMissionId && data.missionId !== parentMissionId;

          if (isSubAgentPacket) {
            return prev;
          }

          if (data.type === PACKET_TYPES.METADATA && data.meta) {
            lastMessage.meta = data.meta as MissionMeta;
            const metaObj = data.meta as any;
            if (metaObj?.maxIterations) {
              setAgentProgress(prev => prev ? { ...prev, totalIterations: metaObj.maxIterations } : { iteration: 1, totalIterations: metaObj.maxIterations });
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
            setAgentProgress(prev => {
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
            setAgentProgress(prev => {
              if (!prev) return null;
              const nextProgress = { ...prev, currentTool: undefined };
              if (data.toolResult?.failedUrls && Array.isArray(data.toolResult.failedUrls) && nextProgress.swarm) {
                nextProgress.swarm = {
                  ...nextProgress.swarm,
                  failedUrls: data.toolResult.failedUrls,
                  failedCount: data.toolResult.failedUrls.length
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
            lastMessage.steps.push({
              type: PACKET_TYPES.TODO,
              todos: data.todos
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
              setAgentProgress(prev => {
                if (!prev) {
                  prev = { iteration: 1, totalIterations: 0 };
                }
                const swarm = prev.swarm || { scrapedCount: 0, failedCount: 0, factsCount: 0, discoveredCount: 0, failedUrls: [], activeUrls: {} };
                const activeUrls = { ...swarm.activeUrls };
                const s = data.swarm!;
                
                if (s.url) {
                  const existing = activeUrls[s.url] || { url: s.url, status: '', factsCount: 0, dataSize: 0 };
                  let newStatus = s.status;
                  let factsCount = s.factsCount ?? existing.factsCount;
                  let dataSize = s.dataSize ?? existing.dataSize;
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
                
                // Re-calculate counts
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
          } else {
            // Handle various SSE formats safely
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

          return [...prev.slice(0, -1), lastMessage];
        });
      });
    } catch (err: any) {
      console.error(CHAT_MESSAGES.ERROR, err);
      setMessages((prev) => {
        const lastIdx = prev.length - 1;
        const lastMessage = { 
          ...prev[lastIdx], 
          content: `Error: ${err.message || "Failed to fetch response from agent."}` 
        };
        return [...prev.slice(0, -1), lastMessage];
      });
    } finally {
      setIsLoading(false);
      setAgentProgress(null);
    }
  };

  const clearMessages = () => setMessages([]);

  return {
    messages,
    isLoading,
    agentProgress,
    sendMessage,
    clearMessages
  };
}
