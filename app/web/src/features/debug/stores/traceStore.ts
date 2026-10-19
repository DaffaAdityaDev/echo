import { create } from "zustand";
// Debug store intentionally reads chat (active session) and settings (defaults)
// cross-feature state — it mirrors live mission telemetry, so the coupling is
// deliberate. Packet-to-span mapping lives in trace-reducers.ts.
import { useChatStore } from "@/features/chat/stores/chatStore";
import type { StreamPacket } from "@/features/chat/types";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import type { AgentConfig } from "@/features/settings/types";
import type { JsonObject, JsonValue } from "@/types/json";
import { applyPacketToTrace } from "./trace-reducers";

export interface Span {
  id: string;
  traceId: string;
  parentId: string | null;
  name: string;
  type: "root" | "thought" | "tool" | "subagent" | "swarm_status" | "file_operation" | "todo" | "error" | "info";
  status: "streaming" | "complete" | "failed" | "skipped";
  startTime: number;
  endTime?: number;
  durationMs: number;
  input?: JsonValue;
  output?: JsonValue;
  metadata?: JsonObject;
  tokens?: number;
  cost?: number;
}

export interface Trace {
  id: string;
  missionId: string;
  sessionId?: string | null;
  sessionTitle?: string;
  name: string;
  status: "streaming" | "interrupted" | "error" | "complete";
  startTime: number;
  endTime?: number;
  durationMs: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens?: number;
  costUsd: number;
  model?: string;
  output?: string;
  metadata: JsonObject;
  spans: Span[];
}

interface TraceState {
  traces: Trace[];
  runSeq: number;
  addOrUpdateTraceFromPacket: (packet: StreamPacket) => void;
  finalizeInterruptedForSession: (sessionId: string) => void;
  clearTraces: () => void;
}

interface InterruptedTracesResult {
  traces: Trace[];
  interruptedAny: boolean;
}

// Traces are ephemeral session telemetry: kept in memory only, never persisted
// to localStorage (mission content can contain sensitive data).
const createTrace = (
  traceId: string,
  missionId: string,
  timestamp: number,
  activeSessionId: string | null,
  sessionTitle: string,
  settings: AgentConfig,
): Trace => ({
  id: traceId,
  missionId,
  sessionId: activeSessionId,
  sessionTitle,
  name: sessionTitle !== "New Chat" ? sessionTitle : `Mission ${missionId.slice(0, 8)}`,
  status: "streaming",
  startTime: timestamp,
  durationMs: 0,
  totalTokens: 0,
  promptTokens: 0,
  completionTokens: 0,
  cachedTokens: 0,
  costUsd: 0,
  spans: [],
  metadata: { mode: settings.defaultMode },
  output: "",
  model: settings.defaultModel || undefined,
});

// The agent reuses the session id as missionId for every turn, so a session
// yields one trace per run: packets join the newest trace of their mission
// while it streams, and a finished trace only absorbs trailing packets.
const TRAILING_PACKET_TYPES: ReadonlySet<StreamPacket["type"]> = new Set([
  "debug",
  "heartbeat",
  "usage",
  "token_metrics",
  "turn_complete",
  "mission_completed",
]);

const findRunTraceIndex = (traces: Trace[], packet: StreamPacket): number => {
  const index = traces.findIndex((t) => t.missionId === packet.missionId);

  if (index === -1) return -1;

  const acceptsPacket = traces[index].status === "streaming" || TRAILING_PACKET_TYPES.has(packet.type);

  return acceptsPacket ? index : -1;
};

const interruptOtherStreamingTraces = (
  traces: Trace[],
  traceId: string,
  sessionId: string | null,
  timestamp: number,
): InterruptedTracesResult => {
  let interruptedAny = false;

  const nextTraces = traces.map((t) => {
    if (sessionId && t.id !== traceId && t.status === "streaming" && t.sessionId === sessionId) {
      interruptedAny = true;

      return {
        ...t,
        status: "interrupted" as const,
        endTime: timestamp,
        durationMs: Math.max(0, timestamp - t.startTime),
        spans: t.spans.map((s) =>
          s.status === "streaming"
            ? {
                ...s,
                status: "complete" as const,
                endTime: timestamp,
                durationMs: Math.max(0, timestamp - s.startTime),
              }
            : s,
        ),
      };
    }

    return t;
  });

  return { traces: nextTraces, interruptedAny };
};

export const useTraceStore = create<TraceState>((set) => ({
  traces: [],
  runSeq: 0,
  clearTraces: () => {
    set({ traces: [] });
  },
  finalizeInterruptedForSession: (sessionId) => {
    set((state) => {
      const timestamp = Date.now();

      const nextTraces = state.traces.map((t) => {
        if (t.status !== "streaming" || t.sessionId !== sessionId) return t;

        return {
          ...t,
          status: "interrupted" as const,
          endTime: timestamp,
          durationMs: Math.max(0, timestamp - t.startTime),
          spans: t.spans.map((s) =>
            s.status === "streaming"
              ? {
                  ...s,
                  status: "complete" as const,
                  endTime: timestamp,
                  durationMs: Math.max(0, timestamp - s.startTime),
                }
              : s,
          ),
        };
      });

      return { traces: nextTraces };
    });
  },
  addOrUpdateTraceFromPacket: (packet) => {
    if (!packet.missionId) return;

    set((state) => {
      const timestamp = packet.timestamp || Date.now();
      const chatStore = useChatStore.getState();
      const activeSessionId = chatStore.activeSessionId;
      const sessionTitle = chatStore.sessions.find((s) => s.id === activeSessionId)?.title || "New Chat";

      const traceIndex = findRunTraceIndex(state.traces, packet);
      const runSeq = traceIndex === -1 ? state.runSeq + 1 : state.runSeq;
      const traceId = traceIndex === -1 ? `${packet.missionId}-run-${runSeq}` : state.traces[traceIndex].id;

      const trace =
        traceIndex === -1
          ? createTrace(
              traceId,
              packet.missionId,
              timestamp,
              activeSessionId,
              sessionTitle,
              useSettingsStore.getState().config,
            )
          : {
              ...state.traces[traceIndex],
              spans: [...state.traces[traceIndex].spans],
              metadata: { ...state.traces[traceIndex].metadata },
            };

      applyPacketToTrace(trace, packet, {
        timestamp,
        getActiveParentSpanId: (spans) => {
          const activeSubagent = [...spans].reverse().find((s) => s.type === "subagent" && s.status === "streaming");

          return activeSubagent ? activeSubagent.id : null;
        },
      });

      if (trace.status === "streaming") {
        trace.durationMs = Math.max(0, timestamp - trace.startTime);
      }

      const interrupted =
        traceIndex === -1
          ? interruptOtherStreamingTraces(state.traces, traceId, activeSessionId, timestamp)
          : { traces: [...state.traces], interruptedAny: false };

      const nextTraces = interrupted.traces;

      if (traceIndex === -1) {
        nextTraces.unshift(trace);
      } else {
        nextTraces[traceIndex] = trace;
      }

      return { traces: nextTraces.slice(0, 50), runSeq };
    });
  },
}));
