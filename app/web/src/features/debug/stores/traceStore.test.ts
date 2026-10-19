import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { StreamPacket } from "@/features/chat/types";
import { useTraceStore } from "./traceStore";

const base = { missionId: "session-1", step: 1, timestamp: 1000 };

function send(packet: StreamPacket): void {
  useTraceStore.getState().addOrUpdateTraceFromPacket(packet);
}

function runTurn(seqStart: number): void {
  send({ ...base, seq: seqStart, type: "content", content: "hi" });
  send({ ...base, seq: seqStart + 1, type: "turn_complete" });
}

describe("traceStore run keying", () => {
  beforeEach(() => {
    useTraceStore.getState().clearTraces();
  });

  it("creates a separate trace for each run of the same mission", () => {
    runTurn(1);
    runTurn(1);

    const { traces } = useTraceStore.getState();
    assert.equal(traces.length, 2);
    assert.notEqual(traces[0].id, traces[1].id);
    assert.equal(traces[0].missionId, "session-1");
    assert.equal(traces[1].missionId, "session-1");
    assert.equal(traces[0].spans[0].traceId, traces[0].id);
  });

  it("attaches trailing packets to the finished run", () => {
    runTurn(1);
    send({ ...base, seq: 3, type: "heartbeat" });

    assert.equal(useTraceStore.getState().traces.length, 1);
  });

  it("keeps packets of a streaming run in one trace", () => {
    send({ ...base, seq: 1, type: "content", content: "a" });
    send({ ...base, seq: 2, type: "content", content: "b" });

    const { traces } = useTraceStore.getState();
    assert.equal(traces.length, 1);
    assert.equal(traces[0].output, "ab");
  });
});
