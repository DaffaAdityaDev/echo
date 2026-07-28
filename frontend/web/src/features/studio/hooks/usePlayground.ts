"use client";

import { useState } from "react";
import type { StreamPacket } from "@/features/chat/types";
import { useFeatures } from "@/features/shared/hooks/useFeatures";
import { useSkills } from "@/features/shared/hooks/useSkills";
import { api } from "@/lib/api-client";
import { type DebugTab, PACKET_TYPES, STUDIO_ENDPOINTS } from "../constants";
import { useStudioStore } from "../stores/studioStore";
import type { PlaygroundResult } from "../types";
import { finalizeModel } from "./playground-utils";

interface StreamEvent {
  model: string;
  content?: string;
  reasoning?: string;
  event: "started" | "content" | "reasoning" | "done" | "error" | "complete";
  error?: string;
  latency_ms?: number;
  tokens?: number;
}

export function usePlayground() {
  const {
    playgroundPrompt: prompt,
    playgroundVariables: variables,
    selectedModels,
    selectedFeatures,
    selectedSkills,
    playgroundResults: results,
    isPlaygroundRunning: isRunning,
    playgroundError: error,
    streamingContent,
    streamingReasoning,
    setPlaygroundPrompt: setPrompt,
    setPlaygroundVariables: setVariables,
    setSelectedModels,
    setSelectedFeatures,
    setSelectedSkills,
    setPlaygroundResults: setResults,
    setIsPlaygroundRunning: setIsRunning,
    setPlaygroundError: setError,
    setStreamingContent,
    addStreamingChunk,
    setStreamingReasoning,
    addReasoningChunk,
    debugMode,
    debugPackets,
    debugAgentStatus,
    debugMissionMeta,
    debugCumulativeUsage,
    debugInfo,
    debugAgentTree,
    debugStateChanges,
    debugToolCalls,
    debugDegradationLevel,
    debugMissionState,
    debugTotalCost,
    debugMaxIterations,
    debugContent,
    debugReasoning,
    debugIsRunning,
    debugError,
    setDebugMode,
    appendDebugPacket,
    appendDebugInfo,
    setDebugUsage,
    addDebugContent,
    addDebugReasoning,
    addDebugSubagentCall,
    addDebugSubagentResult,
    addDebugToolCall,
    addDebugToolResult,
    addDebugStateChange,
    setDebugDegradation,
    setDebugMissionState,
    setDebugMeta,
    setDebugRunning,
    setDebugError,
    setDebugTotalCost,
    resetDebug,
  } = useStudioStore();

  const { features: allFeatures, isLoading: featuresLoading } = useFeatures();
  const { skills: allSkills, isLoading: skillsLoading } = useSkills();

  const [activeTab, setActiveTab] = useState<DebugTab>("output");
  const [thoughtTraceOpen, setThoughtTraceOpen] = useState(false);

  const openThoughtTrace = () => setThoughtTraceOpen(true);

  const handleToggleDebug = () => {
    const next = !debugMode;
    setDebugMode(next);
    if (!next) resetDebug();
    setActiveTab("output");
    setThoughtTraceOpen(false);
  };

  const handleRun = async () => {
    if (!prompt.trim() || selectedModels.length === 0) return;

    setIsRunning(true);
    setResults(null);
    setStreamingContent({});
    setStreamingReasoning({});
    setError(null);

    const completed = new Map<string, PlaygroundResult>();

    try {
      await api.stream<StreamEvent>(
        STUDIO_ENDPOINTS.PLAYGROUND,
        { prompt, variables, models: selectedModels, features: selectedFeatures, skills: selectedSkills },
        (data) => {
          const streamState = useStudioStore.getState();
          switch (data.event) {
            case "content":
              addStreamingChunk(data.model, data.content || "");
              break;
            case "reasoning":
              addReasoningChunk(data.model, data.reasoning || "");
              break;
            case "done":
              finalizeModel(
                completed,
                data.model,
                {
                  content: data.content ?? streamState.streamingContent[data.model] ?? "",
                  reasoning: data.reasoning ?? streamState.streamingReasoning[data.model] ?? undefined,
                  latency_ms: data.latency_ms || 0,
                  tokens: data.tokens || 0,
                },
                streamState,
                { setStreamingContent, setStreamingReasoning, setResults },
              );
              break;
            case "started":
              break;
            case "error":
              finalizeModel(
                completed,
                data.model,
                {
                  error: data.error,
                },
                streamState,
                { setStreamingContent, setStreamingReasoning, setResults },
              );
              break;
          }
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsRunning(false);
    }
  };

  const handleDebugRun = async () => {
    if (!prompt.trim()) return;

    resetDebug();
    setDebugRunning(true);
    setDebugError(null);

    try {
      const session = await api.post<{ id: string }>("/sessions", { title: "Debug: " + prompt.substring(0, 40) });

      await api.stream<StreamPacket>(
        "/chat/stream",
        {
          message: prompt,
          sessionId: session.id,
          mode: "agent",
          features: selectedFeatures,
          skills: selectedSkills,
        },
        (packet) => {
          appendDebugPacket(packet);

          switch (packet.type) {
            case PACKET_TYPES.METADATA: {
              const meta = (packet as any).meta;
              const m =
                meta?.maxIterations != null
                  ? meta
                  : {
                      maxIterations: packet.maxIterations,
                      toolsAvailable: packet.toolsAvailable,
                      strategy: packet.strategy,
                    };
              setDebugMeta(m);
              break;
            }
            case PACKET_TYPES.REASONING:
              addDebugReasoning(packet.content ?? "");
              break;
            case PACKET_TYPES.CONTENT:
              addDebugContent(packet.content ?? "");
              break;
            case PACKET_TYPES.TOOL_CALL:
              addDebugToolCall(packet.toolName, packet.toolInput, packet.timestamp);
              break;
            case PACKET_TYPES.TOOL_RESULT:
              addDebugToolResult(packet.toolName, packet.content, packet.timestamp);
              break;
            case PACKET_TYPES.USAGE:
              setDebugUsage(packet.usage);
              break;
            case PACKET_TYPES.STATE_CHANGE:
              addDebugStateChange(packet.from, packet.to, packet.reason, packet.timestamp);
              break;
            case PACKET_TYPES.DEGRADED:
              setDebugDegradation(packet.from, packet.to, packet.reason);
              break;
            case PACKET_TYPES.TURN_COMPLETE:
              setDebugMissionState("completed");
              if (packet.totalCost != null) setDebugTotalCost(packet.totalCost);
              break;
            case PACKET_TYPES.DEBUG:
              appendDebugInfo({
                iteration: packet.step,
                systemPrompt: packet.rawSystemPrompt,
                messages: packet.rawMessages,
              });
              break;
            case PACKET_TYPES.SUBAGENT_CALL:
              addDebugSubagentCall(packet.subagent.name, packet.subagent.instruction);
              break;
            case PACKET_TYPES.SUBAGENT_RESULT:
              addDebugSubagentResult(
                packet.subagent.name,
                packet.subagent.instruction,
                packet.subagent.result ?? "",
                packet.subagent.status,
              );
              break;
            case PACKET_TYPES.ERROR:
              setDebugMissionState("error");
              setDebugError(packet.content);
              break;
          }
        },
      );
    } catch (err) {
      setDebugMissionState("error");
      setDebugError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setDebugRunning(false);
    }
  };

  return {
    prompt,
    setPrompt,
    variables,
    setVariables,
    selectedModels,
    setSelectedModels,
    selectedFeatures,
    setSelectedFeatures,
    selectedSkills,
    setSelectedSkills,
    allFeatures,
    allSkills,
    featuresLoading,
    skillsLoading,
    results,
    isRunning,
    error,
    streamingContent,
    streamingReasoning,
    handleRun,

    debugMode,
    debugAgentStatus,
    debugMissionMeta,
    debugCumulativeUsage,
    debugInfo,
    debugAgentTree,
    debugToolCalls,
    debugStateChanges,
    debugDegradationLevel,
    debugMissionState,
    debugTotalCost,
    debugMaxIterations,
    debugContent,
    debugReasoning,
    debugIsRunning,
    debugError,
    handleDebugRun,
    handleToggleDebug,
    activeTab,
    setActiveTab,
    thoughtTraceOpen,
    openThoughtTrace,
    closeThoughtTrace: () => setThoughtTraceOpen(false),
  };
}
