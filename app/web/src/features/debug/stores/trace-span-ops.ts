import type { JsonObject, JsonValue } from "@/types/json";
import type { Span, Trace } from "./traceStore";

export interface TraceReducerContext {
  timestamp: number;
  getActiveParentSpanId: (spans: Span[]) => string | null;
}

export function compactMetadata(fields: Record<string, JsonValue | undefined>): JsonObject {
  const metadata: JsonObject = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) metadata[key] = value;
  }

  return metadata;
}

export function addSpanIfMissing(trace: Trace, spanId: string, create: () => Omit<Span, "id" | "traceId">): void {
  if (trace.spans.some((s) => s.id === spanId)) return;
  trace.spans.push({ id: spanId, traceId: trace.id, ...create() });
}

export function updateSpanIfExists(trace: Trace, spanId: string, update: (existing: Span) => Span): void {
  const index = trace.spans.findIndex((s) => s.id === spanId);

  if (index > -1) {
    trace.spans[index] = update(trace.spans[index]);
  }
}

export function upsertSpan(
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

export function finalizeStreamingSpans(trace: Trace, timestamp: number): void {
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
