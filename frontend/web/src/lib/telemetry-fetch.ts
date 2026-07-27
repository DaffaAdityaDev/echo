/**
 * Client-Side Telemetry & Trace Propagation Utility
 * Generates W3C-compliant traceparent headers for omni-channel tracking.
 */

export interface TraceContext {
  traceparent: string;
  traceId: string;
  spanId: string;
}

export function generateTraceContext(): TraceContext {
  // Generate a random 16-byte hex string (32 characters) for the trace ID
  const traceIdBytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(traceIdBytes);
  } else {
    for (let i = 0; i < 16; i++) traceIdBytes[i] = Math.floor(Math.random() * 256);
  }
  const traceId = Array.from(traceIdBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Generate a random 8-byte hex string (16 characters) for the parent span ID
  const spanIdBytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(spanIdBytes);
  } else {
    for (let i = 0; i < 8; i++) spanIdBytes[i] = Math.floor(Math.random() * 256);
  }
  const spanId = Array.from(spanIdBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    traceparent: `00-${traceId}-${spanId}-01`,
    traceId,
    spanId
  };
}


