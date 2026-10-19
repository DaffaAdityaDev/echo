import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { useChatStore } from "../../stores/chatStore";
import { stopActiveStream, stopStreamOutsideSession } from "./stop-stream";
import { getActiveStreamRun, startStreamRun } from "./stream-run";

function seedStreamingTurn(): void {
  const store = useChatStore.getState();
  store.setMessages([
    { id: "u1", role: "user", content: "hi", steps: [] },
    { id: "a1", role: "assistant", content: "par", steps: [], status: "streaming" },
  ]);
  store.setIsLoading(true);
}

describe("stopActiveStream", () => {
  it("aborts the run started elsewhere and interrupts its message", () => {
    seedStreamingTurn();
    const run = startStreamRun(null, "a1");

    stopActiveStream();

    const state = useChatStore.getState();
    assert.equal(run.controller.signal.aborted, true);
    assert.equal(getActiveStreamRun(), null);
    assert.equal(state.isLoading, false);
    assert.equal(state.agentState, "aborted");
    assert.equal(state.messages[1].status, "interrupted");
    assert.equal(state.messages[1].content, "par");
  });

  it("is a no-op without an active run", () => {
    useChatStore.getState().setIsLoading(true);
    stopActiveStream();

    assert.equal(useChatStore.getState().isLoading, true);
    useChatStore.getState().setIsLoading(false);
  });
});

describe("stopStreamOutsideSession", () => {
  it("keeps the stream when its own session is selected", () => {
    const run = startStreamRun("s1", "a1");
    stopStreamOutsideSession("s1");

    assert.equal(run.controller.signal.aborted, false);
    stopStreamOutsideSession("s2");
    assert.equal(run.controller.signal.aborted, true);
  });
});
