import { create } from "zustand";
// Debug store intentionally reads chat (active session) and settings (defaults)
// cross-feature state — it mirrors live mission telemetry, so the coupling is
// deliberate. Packet-to-span mapping lives in trace-reducers.ts.
import { useChatStore } from "@/features/chat/stores/chatStore";
import type { StreamPacket } from "@/features/chat/types";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import type { AgentConfig } from "@/features/settings/types";
import { getStorageJSON, setStorageJSON } from "@/utils/storage";
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
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  tokens?: number;
  cost?: number;
}

export interface Trace {
  id: string;
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
  metadata: Record<string, unknown>;
  spans: Span[];
}

interface TraceState {
  traces: Trace[];
  addOrUpdateTraceFromPacket: (packet: StreamPacket) => void;
  finalizeInterruptedForSession: (sessionId: string) => void;
  clearTraces: () => void;
}

const LOCAL_STORAGE_KEY = "echo-traces-list";
const TRIM_LIMIT = 4000;
const PERSIST_DEBOUNCE_MS = 300;

const loadStoredTraces = (): Trace[] => {
  return getStorageJSON<Trace[]>(LOCAL_STORAGE_KEY) || [];
};

const trimValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    return value.length > TRIM_LIMIT ? `${value.slice(0, TRIM_LIMIT)}...[truncated]` : value;
  }
  if (Array.isArray(value)) {
    return value.map(trimValue);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = trimValue(val);
    }
    return out;
  }
  return value;
};

const trimForStorage = (trace: Trace): Trace => ({
  ...trace,
  output: trace.output ? (trimValue(trace.output) as string) : undefined,
  metadata: trimValue(trace.metadata) as Record<string, unknown>,
  spans: trace.spans.map((span) => ({
    ...span,
    input: trimValue(span.input),
    output: trimValue(span.output),
    metadata: trimValue(span.metadata) as Record<string, unknown> | undefined,
  })),
});

const saveStoredTraces = (traces: Trace[]) => {
  setStorageJSON(LOCAL_STORAGE_KEY, traces.slice(0, 50).map(trimForStorage));
};

// Streaming packets settle every few hundred ms; a trailing debounce avoids a
// synchronous localStorage write per packet. Fires with the latest state.
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleStoredTracesSave = () => {
  if (persistTimer !== null) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    saveStoredTraces(useTraceStore.getState().traces);
  }, PERSIST_DEBOUNCE_MS);
};

const createTrace = (
  traceId: string,
  timestamp: number,
  activeSessionId: string | null,
  sessionTitle: string,
  settings: AgentConfig,
): Trace => ({
  id: traceId,
  sessionId: activeSessionId,
  sessionTitle,
  name: sessionTitle !== "New Chat" ? sessionTitle : `Mission ${traceId.slice(0, 8)}`,
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

const interruptOtherStreamingTraces = (
  traces: Trace[],
  traceId: string,
  sessionId: string | null,
  timestamp: number,
): { traces: Trace[]; interruptedAny: boolean } => {
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
  traces: loadStoredTraces(),
  clearTraces: () => {
    set({ traces: [] });
    saveStoredTraces([]);
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
      const changed = nextTraces.some((t, i) => t !== state.traces[i]);
      if (changed) saveStoredTraces(nextTraces);
      return { traces: nextTraces };
    });
  },
  addOrUpdateTraceFromPacket: (packet) => {
    if (!packet.missionId) return;

    set((state) => {
      const traceId = packet.missionId;
      const timestamp = packet.timestamp || Date.now();
      const chatStore = useChatStore.getState();
      const activeSessionId = chatStore.activeSessionId;
      const sessionTitle = chatStore.sessions.find((s) => s.id === activeSessionId)?.title || "New Chat";

      const traceIndex = state.traces.findIndex((t) => t.id === traceId);
      const trace =
        traceIndex === -1
          ? createTrace(traceId, timestamp, activeSessionId, sessionTitle, useSettingsStore.getState().config)
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
          : { traces: state.traces, interruptedAny: false };

      const nextTraces = interrupted.traces;
      if (traceIndex === -1) {
        nextTraces.unshift(trace);
      } else {
        nextTraces[traceIndex] = trace;
      }

      if (trace.status !== "streaming" || interrupted.interruptedAny) {
        scheduleStoredTracesSave();
      }

      return { traces: nextTraces.slice(0, 50) };
    });
  },
}));
