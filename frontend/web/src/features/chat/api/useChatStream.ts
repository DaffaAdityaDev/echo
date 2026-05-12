"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Message, StreamPacket, HistoryMessage, MissionMeta, TokenUsage } from "../types";
import { CHAT_ROLES, CHAT_MODES, PACKET_TYPES, CHAT_MESSAGES, CHAT_ENDPOINTS } from "../constants";

export function useChatStream(selectedModel: string, mode: typeof CHAT_MODES[keyof typeof CHAT_MODES] | string) {

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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

    try {
      const history: HistoryMessage[] = messages
        .filter(m => m.content.trim().length > 0)
        .map(m => ({ role: m.role, content: m.content }));

      await api.stream<StreamPacket>(CHAT_ENDPOINTS.STREAM, { 
        message: input, 
        model: selectedModel,
        mode: mode,
        history
      }, (data) => {
        setMessages((prev) => {
          const lastIdx = prev.length - 1;
          const lastMessage = { ...prev[lastIdx], steps: [...prev[lastIdx].steps] };

          if (data.type === PACKET_TYPES.METADATA && data.meta) {
            lastMessage.meta = data.meta as MissionMeta;
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
            lastMessage.steps.push({
              type: PACKET_TYPES.TOOL_CALL,
              toolName: data.toolName,
              toolInput: data.toolInput
            });
          } else if (data.type === PACKET_TYPES.TOOL_RESULT) {
            lastMessage.steps.push({
              type: PACKET_TYPES.TOOL_RESULT,
              toolName: data.toolName,
              content: data.content
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
    } catch (err) {
      console.error(CHAT_MESSAGES.ERROR, err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => setMessages([]);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages
  };
}
