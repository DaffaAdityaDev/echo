import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { useChatStore } from "../../stores/chatStore";
import { createResumePacketHandler } from "./resume-stream";

const turnCompletePacket = { missionId: "m1", step: 1, seq: 1, timestamp: 0, type: "turn_complete" as const };

function lastStatus() {
  const msgs = useChatStore.getState().messages;

  return msgs[msgs.length - 1]?.status;
}

describe("createResumePacketHandler", () => {
  beforeEach(() => {
    useChatStore.getState().setMessages(() => [
      { id: "a1", role: "assistant", content: "", steps: [], status: "streaming" },
    ]);
  });

  it("applies packets while the approval session is active", () => {
    useChatStore.getState().setActiveSession("s1");
    createResumePacketHandler("s1")(turnCompletePacket);

    assert.equal(lastStatus(), "complete");
  });

  it("drops packets after the user switched sessions", () => {
    useChatStore.getState().setActiveSession("s2");
    createResumePacketHandler("s1")(turnCompletePacket);

    assert.equal(lastStatus(), "streaming");
  });
});
