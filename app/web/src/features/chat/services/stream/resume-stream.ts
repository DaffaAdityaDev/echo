import { useChatStore } from "../../stores/chatStore";
import type { StreamPacket } from "../../types";
import { applyStreamPacket } from ".";

// A resumed mission belongs to the session that raised the approval; packets
// are dropped once the user has switched to another chat.
export function createResumePacketHandler(sessionId: string): (data: StreamPacket) => void {
  return (data) => {
    if (useChatStore.getState().activeSessionId === sessionId) applyStreamPacket(data);
  };
}
