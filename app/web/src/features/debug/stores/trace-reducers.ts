import type { StreamPacket } from "@/features/chat/types";
import {
  reduceContent,
  reduceFileOperation,
  reduceHitlApproval,
  reduceReasoning,
  reduceSubagent,
  reduceSwarmStatus,
  reduceTodo,
  reduceToolCall,
  reduceToolResult,
  reduceToolSkip,
} from "./step-span-reducers";
import { addSpanIfMissing, compactMetadata, finalizeStreamingSpans, type TraceReducerContext } from "./trace-span-ops";
import type { Trace } from "./traceStore";

type MetadataPacket = Extract<StreamPacket, { type: "metadata" }>;

type StatePacket = Extract<StreamPacket, { type: "state_change" | "degraded" }>;

function reduceMetadata(trace: Trace, packet: MetadataPacket, ctx: TraceReducerContext): void {
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

  addSpanIfMissing(trace, `${trace.id}-metadata-${packet.step}-${packet.seq}`, () => ({
    parentId: ctx.getActiveParentSpanId(trace.spans),
    name: "Mission Initiated",
    type: "info",
    status: "complete",
    startTime: ctx.timestamp,
    endTime: ctx.timestamp,
    durationMs: 0,
    input: packet.objective || "",
    metadata: compactMetadata({
      strategy: packet.strategy,
      historyDepth: packet.historyDepth,
      toolsAvailable: packet.toolsAvailable,
      maxIterations: packet.maxIterations,
    }),
  }));
}

function reduceUsage(trace: Trace, packet: Extract<StreamPacket, { type: "usage" }>): void {
  trace.totalTokens = packet.usage.totalTokens;
  trace.promptTokens = packet.usage.promptTokens;
  trace.completionTokens = packet.usage.completionTokens;

  if (packet.usage.cachedTokens !== undefined) {
    trace.cachedTokens = packet.usage.cachedTokens;
  }
}

function reduceTokenMetrics(trace: Trace, packet: Extract<StreamPacket, { type: "token_metrics" }>): void {
  trace.totalTokens = packet.payload.totalTokens;
  trace.promptTokens = packet.payload.promptTokens;
  trace.completionTokens = packet.payload.completionTokens;

  if (packet.payload.cachedTokens !== undefined) {
    trace.cachedTokens = packet.payload.cachedTokens;
  }

  if (packet.payload.estimatedCostUsd !== undefined) {
    trace.costUsd = Number(packet.payload.estimatedCostUsd);
  }
}

function reduceStateChange(trace: Trace, packet: StatePacket, ctx: TraceReducerContext): void {
  addSpanIfMissing(trace, `${trace.id}-state-${packet.step}-${packet.seq}`, () => ({
    parentId: ctx.getActiveParentSpanId(trace.spans),
    name: `State Transition: ${packet.type === "degraded" ? "DEGRADED" : packet.to}`,
    type: "info",
    status: "complete",
    startTime: ctx.timestamp,
    endTime: ctx.timestamp,
    durationMs: 0,
    output: packet.reason || "",
    metadata: { from: packet.from, to: packet.to },
  }));
}

function reduceProgress(trace: Trace, packet: Extract<StreamPacket, { type: "progress" }>): void {
  trace.metadata.currentPhase = packet.phase;
}

function reduceError(trace: Trace, packet: Extract<StreamPacket, { type: "error" }>, ctx: TraceReducerContext): void {
  trace.status = "error";
  trace.spans = trace.spans.map((s) =>
    s.status === "streaming"
      ? {
          ...s,
          status: "failed",
          output: packet.content,
          endTime: ctx.timestamp,
          durationMs: Math.max(0, ctx.timestamp - s.startTime),
        }
      : s,
  );
  addSpanIfMissing(trace, `${trace.id}-error-${packet.step}-${packet.seq}`, () => ({
    parentId: ctx.getActiveParentSpanId(trace.spans),
    name: "Execution Error",
    type: "error",
    status: "failed",
    startTime: ctx.timestamp,
    endTime: ctx.timestamp,
    durationMs: 0,
    output: packet.content,
    metadata: compactMetadata({ code: packet.code }),
  }));
}

function reduceSystemNotice(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "system_notice" }>,
  ctx: TraceReducerContext,
): void {
  addSpanIfMissing(trace, `${trace.id}-notice-${packet.step}-${packet.seq}`, () => ({
    parentId: ctx.getActiveParentSpanId(trace.spans),
    name: `System Notice [${packet.payload.level.toUpperCase()}]`,
    type: "info",
    status: packet.payload.level === "error" ? "failed" : "complete",
    startTime: ctx.timestamp,
    endTime: ctx.timestamp,
    durationMs: 0,
    output: packet.payload.message,
    metadata: { code: packet.payload.code },
  }));
}


function reduceTurnComplete(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "turn_complete" }>,
  ctx: TraceReducerContext,
): void {
  trace.status = "complete";

  if (packet.totalCost !== undefined) {
    trace.costUsd = Number(packet.totalCost);
  }

  if (packet.usage) {
    trace.totalTokens = packet.usage.totalTokens;
    trace.promptTokens = packet.usage.promptTokens;
    trace.completionTokens = packet.usage.completionTokens;
  }

  trace.endTime = ctx.timestamp;
  trace.durationMs = Math.max(0, ctx.timestamp - trace.startTime);
  finalizeStreamingSpans(trace, ctx.timestamp);
}

function reduceMissionCompleted(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "mission_completed" }>,
  ctx: TraceReducerContext,
): void {
  trace.status = "complete";

  if (packet.payload) {
    trace.costUsd = Number(packet.payload.totalCostUsd);

    if (packet.payload.durationMs) {
      trace.durationMs = packet.payload.durationMs;
    }
  }

  trace.endTime = ctx.timestamp;

  if (!trace.durationMs) {
    trace.durationMs = Math.max(0, ctx.timestamp - trace.startTime);
  }

  finalizeStreamingSpans(trace, ctx.timestamp);
}

export function applyPacketToTrace(trace: Trace, packet: StreamPacket, ctx: TraceReducerContext): void {
  switch (packet.type) {
    case "metadata":
      reduceMetadata(trace, packet, ctx);
      break;
    case "reasoning":
      reduceReasoning(trace, packet, ctx);
      break;
    case "content":
      reduceContent(trace, packet, ctx);
      break;
    case "tool_call":
      reduceToolCall(trace, packet, ctx);
      break;
    case "tool_result":
      reduceToolResult(trace, packet, ctx);
      break;
    case "tool_skip":
      reduceToolSkip(trace, packet, ctx);
      break;
    case "todo":
      reduceTodo(trace, packet, ctx);
      break;
    case "subagent_call":
    case "subagent_result":
      reduceSubagent(trace, packet, ctx);
      break;
    case "file_operation":
      reduceFileOperation(trace, packet, ctx);
      break;
    case "swarm_status":
      reduceSwarmStatus(trace, packet, ctx);
      break;
    case "usage":
      reduceUsage(trace, packet);
      break;
    case "token_metrics":
      reduceTokenMetrics(trace, packet);
      break;
    case "state_change":
    case "degraded":
      reduceStateChange(trace, packet, ctx);
      break;
    case "progress":
      reduceProgress(trace, packet);
      break;
    case "error":
      reduceError(trace, packet, ctx);
      break;
    case "system_notice":
      reduceSystemNotice(trace, packet, ctx);
      break;
    case "hitl_approval_required":
      reduceHitlApproval(trace, packet, ctx);
      break;
    case "turn_complete":
      reduceTurnComplete(trace, packet, ctx);
      break;
    case "mission_completed":
      reduceMissionCompleted(trace, packet, ctx);
      break;
    case "debug":
    case "heartbeat":
      break;
  }
}
