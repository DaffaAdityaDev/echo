import type { StreamPacket } from "@/features/chat/types";
import { addSpanIfMissing, type TraceReducerContext, updateSpanIfExists, upsertSpan } from "./trace-span-ops";
import type { Trace } from "./traceStore";

type SubagentPacket = Extract<StreamPacket, { type: "subagent_call" | "subagent_result" }>;

export function reduceReasoning(
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

export function reduceContent(
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

export function reduceToolCall(
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

export function reduceToolResult(
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

export function reduceToolSkip(
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

export function reduceTodo(trace: Trace, packet: Extract<StreamPacket, { type: "todo" }>, ctx: TraceReducerContext): void {
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

export function reduceSubagent(trace: Trace, packet: SubagentPacket, ctx: TraceReducerContext): void {
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

export function reduceFileOperation(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "file_operation" }>,
  ctx: TraceReducerContext,
): void {
  const { operation, path, preview } = packet.fileOp;
  addSpanIfMissing(trace, `${trace.id}-fileop-${packet.step}-${packet.seq}`, () => ({
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
  }));
}

export function reduceSwarmStatus(
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

export function reduceHitlApproval(
  trace: Trace,
  packet: Extract<StreamPacket, { type: "hitl_approval_required" }>,
  ctx: TraceReducerContext,
): void {
  addSpanIfMissing(trace, `${trace.id}-hitl-${packet.step}`, () => ({
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
  }));
}
