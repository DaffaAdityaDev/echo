import type { StreamPacket } from "@/features/chat/types";
import type { Span, Trace } from "./traceStore";

export interface TraceReducerContext {
  timestamp: number;
  getActiveParentSpanId: (spans: Span[]) => string | null;
}

type MetadataPacket = Extract<StreamPacket, { type: "metadata" }>;
type SubagentPacket = Extract<StreamPacket, { type: "subagent_call" | "subagent_result" }>;
type StatePacket = Extract<StreamPacket, { type: "state_change" | "degraded" }>;

function addSpanIfMissing(trace: Trace, spanId: string, create: () => Omit<Span, "id" | "traceId">): void {
  if (trace.spans.some((s) => s.id === spanId)) return;
  trace.spans.push({ id: spanId, traceId: trace.id, ...create() });
}

function updateSpanIfExists(trace: Trace, spanId: string, update: (existing: Span) => Span): void {
  const index = trace.spans.findIndex((s) => s.id === spanId);
  if (index > -1) {
    trace.spans[index] = update(trace.spans[index]);
  }
}

function upsertSpan(
  trace: Trace,
  spanId: string,
  ctx: TraceReducerContext,
  create: () => Omit<Span, "id" | "traceId">,
  update: (existing: Span, timestamp: number) => Span,
): void {
  const index = trace.spans.findIndex((s) => s.id === spanId);
  if (index > -1) {
    trace.spans[index] = update(trace.spans[index], ctx.timestamp);
    return;
  }
  trace.spans.push({ id: spanId, traceId: trace.id, ...create() });
}

function finalizeStreamingSpans(trace: Trace, timestamp: number): void {
  trace.spans = trace.spans.map((s) =>
    s.status === "streaming"
      ? {
          ...s,
          status: "complete",
          endTime: timestamp,
          durationMs: Math.max(0, timestamp - s.startTime),
        }
      : s,
  );
}

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
    metadata: {
      strategy: packet.strategy,
      historyDepth: packet.historyDepth,
      toolsAvailable: packet.toolsAvailable,
      maxIterations: packet.maxIterations,
    },
  }));
}

function reduceReasoning(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "reasoning" }>,
  ctx: TraceReducerContext,
): void {
  upsertSpan(
    trace,
    `${trace.id}-reasoning-${packet.step}`,
    ctx,
    () => ({
      parentId: ctx.getActiveParentSpanId(trace.spans),
      name: "Reasoning",
      type: "thought",
      status: "streaming",
      startTime: ctx.timestamp,
      endTime: ctx.timestamp,
      durationMs: 0,
      output: packet.content,
    }),
    (existing, timestamp) => ({
      ...existing,
      output: (existing.output || "") + packet.content,
      endTime: timestamp,
      durationMs: Math.max(0, timestamp - existing.startTime),
    }),
  );
}

function reduceContent(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "content" }>,
  ctx: TraceReducerContext,
): void {
  trace.output = (trace.output || "") + packet.content;
  upsertSpan(
    trace,
    `${trace.id}-content`,
    ctx,
    () => ({
      parentId: ctx.getActiveParentSpanId(trace.spans),
      name: "Agent Response",
      type: "info",
      status: "streaming",
      startTime: ctx.timestamp,
      endTime: ctx.timestamp,
      durationMs: 0,
      output: packet.content,
    }),
    (existing, timestamp) => ({
      ...existing,
      output: (existing.output || "") + packet.content,
      endTime: timestamp,
      durationMs: Math.max(0, timestamp - existing.startTime),
    }),
  );
}

function reduceToolCall(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "tool_call" }>,
  ctx: TraceReducerContext,
): void {
  addSpanIfMissing(trace, `${trace.id}-tool-${packet.toolName}-${packet.step}`, () => ({
    parentId: ctx.getActiveParentSpanId(trace.spans),
    name: `Tool: ${packet.toolName}`,
    type: "tool",
    status: "streaming",
    startTime: ctx.timestamp,
    durationMs: 0,
    input: packet.toolInput,
  }));
}

function reduceToolResult(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "tool_result" }>,
  ctx: TraceReducerContext,
): void {
  updateSpanIfExists(trace, `${trace.id}-tool-${packet.toolName}-${packet.step}`, (span) => ({
    ...span,
    status: "complete",
    output: packet.toolResult !== undefined ? packet.toolResult : packet.content,
    endTime: ctx.timestamp,
    durationMs: Math.max(0, ctx.timestamp - span.startTime),
  }));
}

function reduceToolSkip(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "tool_skip" }>,
  ctx: TraceReducerContext,
): void {
  upsertSpan(
    trace,
    `${trace.id}-tool-${packet.toolName}-${packet.step}`,
    ctx,
    () => ({
      parentId: ctx.getActiveParentSpanId(trace.spans),
      name: `Tool: ${packet.toolName}`,
      type: "tool",
      status: "skipped",
      startTime: ctx.timestamp,
      endTime: ctx.timestamp,
      durationMs: 0,
      output: "Skipped",
    }),
    (span, timestamp) => ({
      ...span,
      status: "skipped",
      output: "Skipped",
      endTime: timestamp,
      durationMs: Math.max(0, timestamp - span.startTime),
    }),
  );
}

function reduceTodo(trace: Trace, packet: Extract<StreamPacket, { type: "todo" }>, ctx: TraceReducerContext): void {
  upsertSpan(
    trace,
    `${trace.id}-todo-${packet.step}`,
    ctx,
    () => ({
      parentId: ctx.getActiveParentSpanId(trace.spans),
      name: "Task List Update",
      type: "todo",
      status: "complete",
      startTime: ctx.timestamp,
      endTime: ctx.timestamp,
      durationMs: 0,
      output: packet.todos,
    }),
    (existing, timestamp) => ({ ...existing, output: packet.todos, endTime: timestamp }),
  );
}

function reduceSubagent(trace: Trace, packet: SubagentPacket, ctx: TraceReducerContext): void {
  const spanId = `${trace.id}-subagent-${packet.subagent.name}-${packet.step}`;
  if (packet.type === "subagent_call") {
    addSpanIfMissing(trace, spanId, () => ({
      parentId: ctx.getActiveParentSpanId(trace.spans),
      name: `Subagent: ${packet.subagent.name}`,
      type: "subagent",
      status: "streaming",
      startTime: ctx.timestamp,
      durationMs: 0,
      input: packet.subagent.instruction,
    }));
    return;
  }
  updateSpanIfExists(trace, spanId, (span) => ({
    ...span,
    status: packet.subagent.status === "completed" ? "complete" : "failed",
    output: packet.subagent.result,
    endTime: ctx.timestamp,
    durationMs: Math.max(0, ctx.timestamp - span.startTime),
  }));
}

function reduceFileOperation(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "file_operation" }>,
  ctx: TraceReducerContext,
): void {
  const { operation, path, preview } = packet.fileOp;
  trace.spans.push({
    id: `${trace.id}-fileop-${packet.step}-${packet.seq}`,
    traceId: trace.id,
    parentId: ctx.getActiveParentSpanId(trace.spans),
    name: `File: ${operation.toUpperCase()} ${path.split("/").pop()}`,
    type: "file_operation",
    status: "complete",
    startTime: ctx.timestamp,
    endTime: ctx.timestamp,
    durationMs: 0,
    input: path,
    output: preview,
    metadata: { operation, fullPath: path },
  });
}

function reduceSwarmStatus(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "swarm_status" }>,
  ctx: TraceReducerContext,
): void {
  upsertSpan(
    trace,
    `${trace.id}-swarm-${packet.step}`,
    ctx,
    () => ({
      parentId: ctx.getActiveParentSpanId(trace.spans),
      name: `Swarm Status: ${packet.swarm.status}`,
      type: "swarm_status",
      status: "complete",
      startTime: ctx.timestamp,
      endTime: ctx.timestamp,
      durationMs: 0,
      output: packet.swarm,
    }),
    (existing, timestamp) => ({ ...existing, output: packet.swarm, endTime: timestamp }),
  );
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
  trace.spans.push({
    id: `${trace.id}-state-${packet.step}-${packet.seq}`,
    traceId: trace.id,
    parentId: ctx.getActiveParentSpanId(trace.spans),
    name: `State Transition: ${packet.type === "degraded" ? "DEGRADED" : packet.to}`,
    type: "info",
    status: "complete",
    startTime: ctx.timestamp,
    endTime: ctx.timestamp,
    durationMs: 0,
    output: packet.reason || "",
    metadata: { from: packet.from, to: packet.to },
  });
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
  trace.spans.push({
    id: `${trace.id}-error-${packet.step}-${packet.seq}`,
    traceId: trace.id,
    parentId: ctx.getActiveParentSpanId(trace.spans),
    name: "Execution Error",
    type: "error",
    status: "failed",
    startTime: ctx.timestamp,
    endTime: ctx.timestamp,
    durationMs: 0,
    output: packet.content,
    metadata: { code: packet.code },
  });
}

function reduceSystemNotice(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "system_notice" }>,
  ctx: TraceReducerContext,
): void {
  trace.spans.push({
    id: `${trace.id}-notice-${packet.step}-${packet.seq}`,
    traceId: trace.id,
    parentId: ctx.getActiveParentSpanId(trace.spans),
    name: `System Notice [${packet.payload.level.toUpperCase()}]`,
    type: "info",
    status: packet.payload.level === "error" ? "failed" : "complete",
    startTime: ctx.timestamp,
    endTime: ctx.timestamp,
    durationMs: 0,
    output: packet.payload.message,
    metadata: { code: packet.payload.code },
  });
}

function reduceHitlApproval(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "hitl_approval_required" }>,
  ctx: TraceReducerContext,
): void {
  trace.spans.push({
    id: `${trace.id}-hitl-${packet.step}`,
    traceId: trace.id,
    parentId: ctx.getActiveParentSpanId(trace.spans),
    name: `HITL Approval: ${packet.payload.toolName}`,
    type: "tool",
    status: "streaming",
    startTime: ctx.timestamp,
    durationMs: 0,
    input: {
      approvalId: packet.payload.approvalId,
      args: packet.payload.args,
      riskLevel: packet.payload.riskLevel,
      expiresAt: packet.payload.expiresAt,
    },
  });
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
