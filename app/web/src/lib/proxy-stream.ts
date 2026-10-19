import { NextResponse } from "next/server";

const EVENT_STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

// Non-standard "client closed request": nobody reads it, it only keeps an
// aborted proxy call out of the 5xx error path.
const CLIENT_CLOSED_REQUEST = 499;

function emptyStream(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

async function relayUpstreamError(upstream: Response): Promise<Response> {
  const errorText = await upstream.text();

  return new Response(errorText, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}

function relayEventStream(upstream: Response, forwardHeaders: readonly string[]): Response {
  const headers = new Headers(EVENT_STREAM_HEADERS);

  for (const name of forwardHeaders) {
    headers.set(name, upstream.headers.get(name) || "");
  }

  return new Response(upstream.body ?? emptyStream(), { status: upstream.status, headers });
}

// proxyEventStream relays a backend SSE endpoint. An unreachable backend
// yields a JSON 502 the client can surface, never a framework HTML error
// page that would be rendered as assistant text. Pass the incoming request's
// signal in init so a client disconnect aborts the upstream call.
export async function proxyEventStream(
  url: string,
  init: RequestInit,
  forwardHeaders: readonly string[] = [],
): Promise<Response> {
  try {
    const upstream = await fetch(url, init);

    if (!upstream.ok) return await relayUpstreamError(upstream);

    return relayEventStream(upstream, forwardHeaders);
  } catch (err: unknown) {
    if (init.signal?.aborted) return new Response(null, { status: CLIENT_CLOSED_REQUEST });

    console.error(`[proxyEventStream] Error fetching ${url}:`, err);

    return NextResponse.json({ error: "Backend service is unavailable" }, { status: 502 });
  }
}
