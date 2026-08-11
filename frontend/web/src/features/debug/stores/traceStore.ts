import { create } from "zustand";
import { useChatStore } from "@/features/chat/stores/chatStore";
import type { StreamPacket } from "@/features/chat/types";
import { useSettingsStore } from "@/features/settings/stores/settingsStore";
import { getStorageJSON, setStorageJSON } from "@/utils/storage";

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
  clearTraces: () => void;
}

const LOCAL_STORAGE_KEY = "echo-traces-list";
const TRIM_LIMIT = 4000;

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

export const useTraceStore = create<TraceState>((set) => ({
  traces: loadStoredTraces(),
  clearTraces: () => {
    set({ traces: [] });
    saveStoredTraces([]);
  },
  addOrUpdateTraceFromPacket: (packet) => {
    if (!packet.missionId) return;

    set((state) => {
      const traceId = packet.missionId;
      const timestamp = packet.timestamp || Date.now();

      const chatStore = useChatStore.getState();
      const activeSessionId = chatStore.activeSessionId;
      const session = chatStore.sessions.find((s) => s.id === activeSessionId);
      const sessionTitle = session?.title || "New Chat";

      const traceIndex = state.traces.findIndex((t) => t.id === traceId);
      let trace: Trace;

      if (traceIndex === -1) {
        const settings = useSettingsStore.getState().config;
        trace = {
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
        };
      } else {
        const existing = state.traces[traceIndex];
        trace = {
          ...existing,
          spans: [...existing.spans],
          metadata: { ...existing.metadata },
        };
      }

      const getActiveParentSpanId = (spans: Span[]): string | null => {
        const activeSubagent = [...spans].reverse().find((s) => s.type === "subagent" && s.status === "streaming");
        return activeSubagent ? activeSubagent.id : null;
      };

      switch (packet.type) {
        case "metadata": {
          if (packet.meta) {
            trace.metadata = { ...trace.metadata, ...packet.meta };
            if (packet.meta.objective) {
              trace.name =
                packet.meta.objective.length > 60 ? `${packet.meta.objective.slice(0, 60)}...` : packet.meta.objective;
            }
          }
          if (packet.strategy) trace.metadata.strategy = packet.strategy;
          if (packet.objective) {
            trace.metadata.objective = packet.objective;
            trace.name = packet.objective.length > 60 ? `${packet.objective.slice(0, 60)}...` : packet.objective;
          }
          if (packet.title) trace.name = packet.title;

          const spanId = `${traceId}-metadata-${packet.step}-${packet.seq}`;
          if (!trace.spans.some((s) => s.id === spanId)) {
            trace.spans.push({
              id: spanId,
              traceId,
              parentId: getActiveParentSpanId(trace.spans),
              name: "Mission Initiated",
              type: "info",
              status: "complete",
              startTime: timestamp,
              endTime: timestamp,
              durationMs: 0,
              input: packet.objective || "",
              metadata: {
                strategy: packet.strategy,
                historyDepth: packet.historyDepth,
                toolsAvailable: packet.toolsAvailable,
                maxIterations: packet.maxIterations,
              },
            });
          }
          break;
        }

        case "reasoning": {
          const spanId = `${traceId}-reasoning-${packet.step}`;
          const existingSpanIdx = trace.spans.findIndex((s) => s.id === spanId);
          if (existingSpanIdx > -1) {
            const existingSpan = trace.spans[existingSpanIdx];
            trace.spans[existingSpanIdx] = {
              ...existingSpan,
              output: (existingSpan.output || "") + packet.content,
              endTime: timestamp,
              durationMs: Math.max(0, timestamp - existingSpan.startTime),
            };
          } else {
            trace.spans.push({
              id: spanId,
              traceId,
              parentId: getActiveParentSpanId(trace.spans),
              name: "Reasoning",
              type: "thought",
              status: "streaming",
              startTime: timestamp,
              endTime: timestamp,
              durationMs: 0,
              output: packet.content,
            });
          }
          break;
        }

        case "content": {
          trace.output = (trace.output || "") + packet.content;
          const spanId = `${traceId}-content`;
          const existingSpanIdx = trace.spans.findIndex((s) => s.id === spanId);
          if (existingSpanIdx > -1) {
            const existingSpan = trace.spans[existingSpanIdx];
            trace.spans[existingSpanIdx] = {
              ...existingSpan,
              output: (existingSpan.output || "") + packet.content,
              endTime: timestamp,
              durationMs: Math.max(0, timestamp - existingSpan.startTime),
            };
          } else {
            trace.spans.push({
              id: spanId,
              traceId,
              parentId: getActiveParentSpanId(trace.spans),
              name: "Agent Response",
              type: "info",
              status: "streaming",
              startTime: timestamp,
              endTime: timestamp,
              durationMs: 0,
              output: packet.content,
            });
          }
          break;
        }

        case "tool_call": {
          const spanId = `${traceId}-tool-${packet.toolName}-${packet.step}`;
          if (!trace.spans.some((s) => s.id === spanId)) {
            trace.spans.push({
              id: spanId,
              traceId,
              parentId: getActiveParentSpanId(trace.spans),
              name: `Tool: ${packet.toolName}`,
              type: "tool",
              status: "streaming",
              startTime: timestamp,
              durationMs: 0,
              input: packet.toolInput,
            });
          }
          break;
        }

        case "tool_result": {
          const spanId = `${traceId}-tool-${packet.toolName}-${packet.step}`;
          const spanIdx = trace.spans.findIndex((s) => s.id === spanId);
          if (spanIdx > -1) {
            const span = trace.spans[spanIdx];
            trace.spans[spanIdx] = {
              ...span,
              status: "complete",
              output: packet.toolResult !== undefined ? packet.toolResult : packet.content,
              endTime: timestamp,
              durationMs: Math.max(0, timestamp - span.startTime),
            };
          }
          break;
        }

        case "tool_skip": {
          const spanId = `${traceId}-tool-${packet.toolName}-${packet.step}`;
          const spanIdx = trace.spans.findIndex((s) => s.id === spanId);
          if (spanIdx > -1) {
            const span = trace.spans[spanIdx];
            trace.spans[spanIdx] = {
              ...span,
              status: "skipped",
              output: "Skipped",
              endTime: timestamp,
              durationMs: Math.max(0, timestamp - span.startTime),
            };
          } else {
            trace.spans.push({
              id: spanId,
              traceId,
              parentId: getActiveParentSpanId(trace.spans),
              name: `Tool: ${packet.toolName}`,
              type: "tool",
              status: "skipped",
              startTime: timestamp,
              endTime: timestamp,
              durationMs: 0,
              output: "Skipped",
            });
          }
          break;
        }

        case "todo": {
          const spanId = `${traceId}-todo-${packet.step}`;
          const spanIdx = trace.spans.findIndex((s) => s.id === spanId);
          if (spanIdx > -1) {
            trace.spans[spanIdx] = {
              ...trace.spans[spanIdx],
              output: packet.todos,
              endTime: timestamp,
            };
          } else {
            trace.spans.push({
              id: spanId,
              traceId,
              parentId: getActiveParentSpanId(trace.spans),
              name: "Task List Update",
              type: "todo",
              status: "complete",
              startTime: timestamp,
              endTime: timestamp,
              durationMs: 0,
              output: packet.todos,
            });
          }
          break;
        }

        case "subagent_call": {
          const subagentName = packet.subagent.name;
          const spanId = `${traceId}-subagent-${subagentName}-${packet.step}`;
          if (!trace.spans.some((s) => s.id === spanId)) {
            trace.spans.push({
              id: spanId,
              traceId,
              parentId: getActiveParentSpanId(trace.spans),
              name: `Subagent: ${subagentName}`,
              type: "subagent",
              status: "streaming",
              startTime: timestamp,
              durationMs: 0,
              input: packet.subagent.instruction,
            });
          }
          break;
        }

        case "subagent_result": {
          const subagentName = packet.subagent.name;
          const spanId = `${traceId}-subagent-${subagentName}-${packet.step}`;
          const spanIdx = trace.spans.findIndex((s) => s.id === spanId);
          if (spanIdx > -1) {
            const span = trace.spans[spanIdx];
            trace.spans[spanIdx] = {
              ...span,
              status: packet.subagent.status === "completed" ? "complete" : "failed",
              output: packet.subagent.result,
              endTime: timestamp,
              durationMs: Math.max(0, timestamp - span.startTime),
            };
          }
          break;
        }

        case "file_operation": {
          const { operation, path, preview } = packet.fileOp;
          const spanId = `${traceId}-fileop-${packet.step}-${packet.seq}`;
          trace.spans.push({
            id: spanId,
            traceId,
            parentId: getActiveParentSpanId(trace.spans),
            name: `File: ${operation.toUpperCase()} ${path.split("/").pop()}`,
            type: "file_operation",
            status: "complete",
            startTime: timestamp,
            endTime: timestamp,
            durationMs: 0,
            input: path,
            output: preview,
            metadata: { operation, fullPath: path },
          });
          break;
        }

        case "swarm_status": {
          const spanId = `${traceId}-swarm-${packet.step}`;
          const spanIdx = trace.spans.findIndex((s) => s.id === spanId);
          if (spanIdx > -1) {
            trace.spans[spanIdx] = {
              ...trace.spans[spanIdx],
              output: packet.swarm,
              endTime: timestamp,
            };
          } else {
            trace.spans.push({
              id: spanId,
              traceId,
              parentId: getActiveParentSpanId(trace.spans),
              name: `Swarm Status: ${packet.swarm.status}`,
              type: "swarm_status",
              status: "complete",
              startTime: timestamp,
              endTime: timestamp,
              durationMs: 0,
              output: packet.swarm,
            });
          }
          break;
        }

        case "usage": {
          trace.totalTokens = packet.usage.totalTokens;
          trace.promptTokens = packet.usage.promptTokens;
          trace.completionTokens = packet.usage.completionTokens;
          if (packet.usage.cachedTokens !== undefined) {
            trace.cachedTokens = packet.usage.cachedTokens;
          }
          break;
        }

        case "token_metrics": {
          trace.totalTokens = packet.payload.totalTokens;
          trace.promptTokens = packet.payload.promptTokens;
          trace.completionTokens = packet.payload.completionTokens;
          if (packet.payload.cachedTokens !== undefined) {
            trace.cachedTokens = packet.payload.cachedTokens;
          }
          if (packet.payload.estimatedCostUsd !== undefined) {
            trace.costUsd = Number(packet.payload.estimatedCostUsd);
          }
          break;
        }

        case "state_change":
        case "degraded": {
          const spanId = `${traceId}-state-${packet.step}-${packet.seq}`;
          trace.spans.push({
            id: spanId,
            traceId,
            parentId: getActiveParentSpanId(trace.spans),
            name: `State Transition: ${packet.type === "degraded" ? "DEGRADED" : packet.to}`,
            type: "info",
            status: "complete",
            startTime: timestamp,
            endTime: timestamp,
            durationMs: 0,
            output: packet.reason || "",
            metadata: { from: packet.from, to: packet.to },
          });
          break;
        }

        case "progress": {
          trace.metadata.currentPhase = packet.phase;
          break;
        }

        case "error": {
          trace.status = "error";
          trace.spans = trace.spans.map((s) => {
            if (s.status === "streaming") {
              return {
                ...s,
                status: "failed",
                output: packet.content,
                endTime: timestamp,
                durationMs: Math.max(0, timestamp - s.startTime),
              };
            }
            return s;
          });

          const spanId = `${traceId}-error-${packet.step}-${packet.seq}`;
          trace.spans.push({
            id: spanId,
            traceId,
            parentId: getActiveParentSpanId(trace.spans),
            name: "Execution Error",
            type: "error",
            status: "failed",
            startTime: timestamp,
            endTime: timestamp,
            durationMs: 0,
            output: packet.content,
            metadata: { code: packet.code },
          });
          break;
        }

        case "system_notice": {
          const spanId = `${traceId}-notice-${packet.step}-${packet.seq}`;
          trace.spans.push({
            id: spanId,
            traceId,
            parentId: getActiveParentSpanId(trace.spans),
            name: `System Notice [${packet.payload.level.toUpperCase()}]`,
            type: "info",
            status: packet.payload.level === "error" ? "failed" : "complete",
            startTime: timestamp,
            endTime: timestamp,
            durationMs: 0,
            output: packet.payload.message,
            metadata: { code: packet.payload.code },
          });
          break;
        }

        case "hitl_approval_required": {
          const spanId = `${traceId}-hitl-${packet.step}`;
          trace.spans.push({
            id: spanId,
            traceId,
            parentId: getActiveParentSpanId(trace.spans),
            name: `HITL Approval: ${packet.payload.toolName}`,
            type: "tool",
            status: "streaming",
            startTime: timestamp,
            durationMs: 0,
            input: {
              approvalId: packet.payload.approvalId,
              args: packet.payload.args,
              riskLevel: packet.payload.riskLevel,
              expiresAt: packet.payload.expiresAt,
            },
          });
          break;
        }

        case "turn_complete": {
          trace.status = "complete";
          if (packet.totalCost !== undefined) {
            trace.costUsd = Number(packet.totalCost);
          }
          if (packet.usage) {
            trace.totalTokens = packet.usage.totalTokens;
            trace.promptTokens = packet.usage.promptTokens;
            trace.completionTokens = packet.usage.completionTokens;
          }
          trace.endTime = timestamp;
          trace.durationMs = Math.max(0, timestamp - trace.startTime);

          trace.spans = trace.spans.map((s) => {
            if (s.status === "streaming") {
              return {
                ...s,
                status: "complete",
                endTime: timestamp,
                durationMs: Math.max(0, timestamp - s.startTime),
              };
            }
            return s;
          });
          break;
        }

        case "mission_completed": {
          trace.status = "complete";
          if (packet.payload) {
            trace.costUsd = Number(packet.payload.totalCostUsd);
            if (packet.payload.durationMs) {
              trace.durationMs = packet.payload.durationMs;
            }
          }
          trace.endTime = timestamp;
          if (!trace.durationMs) {
            trace.durationMs = Math.max(0, timestamp - trace.startTime);
          }

          trace.spans = trace.spans.map((s) => {
            if (s.status === "streaming") {
              return {
                ...s,
                status: "complete",
                endTime: timestamp,
                durationMs: Math.max(0, timestamp - s.startTime),
              };
            }
            return s;
          });
          break;
        }

        default:
          break;
      }

      if (trace.status === "streaming") {
        trace.durationMs = Math.max(0, timestamp - trace.startTime);
      }

      let interruptedAny = false;
      if (traceIndex === -1 && activeSessionId) {
        interruptedAny = state.traces.some(
          (t) => t.id !== traceId && t.status === "streaming" && t.sessionId === activeSessionId,
        );
      }

      const nextTraces = state.traces.map((t) => {
        if (
          traceIndex === -1 &&
          activeSessionId &&
          t.id !== traceId &&
          t.status === "streaming" &&
          t.sessionId === activeSessionId
        ) {
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

      if (traceIndex === -1) {
        nextTraces.unshift(trace);
      } else {
        nextTraces[traceIndex] = trace;
      }

      const truncatedTraces = nextTraces.slice(0, 50);

      if (trace.status !== "streaming" || interruptedAny) {
        saveStoredTraces(truncatedTraces);
      }

      return { traces: truncatedTraces };
    });
  },
}));
