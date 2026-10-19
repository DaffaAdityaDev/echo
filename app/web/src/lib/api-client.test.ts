import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JsonValue } from "@/types/json";
import { ApiError, buildLoginUrl, hasApiStatus, readStream } from "./api-client";

function sseResponse(chunks: Uint8Array[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}

async function collect(chunks: Uint8Array[]): Promise<JsonValue[]> {
  const packets: JsonValue[] = [];
  await readStream(sseResponse(chunks), (p) => packets.push(p));

  return packets;
}

describe("readStream", () => {
  it("emits a final packet that has no trailing newline", async () => {
    const encoder = new TextEncoder();
    const packets = await collect([encoder.encode('data: {"n":1}\n\ndata: {"n":2}')]);

    assert.deepEqual(packets, [{ n: 1 }, { n: 2 }]);
  });

  it("decodes a multi-byte character split across chunks", async () => {
    const bytes = new TextEncoder().encode('data: {"t":"é"}');
    const packets = await collect([bytes.slice(0, bytes.length - 3), bytes.slice(bytes.length - 3)]);

    assert.deepEqual(packets, [{ t: "é" }]);
  });
});

describe("buildLoginUrl", () => {
  it("carries the current path as an encoded redirect", () => {
    assert.equal(buildLoginUrl("/sessions/a b"), "/login?redirect=%2Fsessions%2Fa%20b");
  });
});

describe("hasApiStatus", () => {
  it("matches an ApiError carrying one of the statuses", () => {
    assert.equal(hasApiStatus(new ApiError("Session not found", 404), 403, 404), true);
  });

  it("rejects other statuses and plain errors", () => {
    assert.equal(hasApiStatus(new ApiError("boom", 500), 403, 404), false);
    assert.equal(hasApiStatus(new Error("Session not found"), 404), false);
  });
});
