import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { useChatStore } from "../../../stores/chatStore";
import type { Message } from "../../../types";
import { handleError, handleMissionCompleted, handleTurnComplete } from "./status";

const base = { missionId: "m1", step: 1, seq: 1, timestamp: 0 };
const errorPacket = { ...base, type: "error" as const, content: "provider down" };
const turnCompletePacket = { ...base, type: "turn_complete" as const };
const missionCompletedPacket = {
  ...base,
  type: "mission_completed" as const,
  payload: { completed: true, totalSteps: 1, totalCostUsd: 0, durationMs: 1 },
};

function streamingMessage(): Message {
  return { id: "a1", role: "assistant", content: "partial", steps: [], status: "streaming" };
}

describe("status handlers", () => {
  it("marks a failed turn as error", () => {
    const msg = streamingMessage();
    handleError(msg, errorPacket, useChatStore.getState());

    assert.equal(msg.status, "error");
    assert.equal(msg.content, "partial\n\n[Error: provider down]");
    assert.equal(useChatStore.getState().agentState, "error");
  });

  it("keeps the error status when a terminal packet follows the error", () => {
    const msg = streamingMessage();
    handleError(msg, errorPacket, useChatStore.getState());
    handleTurnComplete(msg, turnCompletePacket, useChatStore.getState());
    handleMissionCompleted(msg, missionCompletedPacket, useChatStore.getState());

    assert.equal(msg.status, "error");
  });

  it("completes a turn that did not fail", () => {
    const msg = streamingMessage();
    handleTurnComplete(msg, turnCompletePacket, useChatStore.getState());

    assert.equal(msg.status, "complete");
  });
});
