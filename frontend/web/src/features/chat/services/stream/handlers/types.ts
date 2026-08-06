import type { useChatStore } from "../../../stores/chatStore";
import type { StreamPacket } from "../../../types";

export interface ApplyPacketOptions {
  replay?: boolean;
}

// Internal handler context: index always destructures with a default so the
// replay flag is a real boolean by the time it reaches a handler.
export type StreamHandlerOptions = Required<ApplyPacketOptions>;

export type StreamStore = ReturnType<typeof useChatStore.getState>;

export type SubagentPacket = Extract<StreamPacket, { type: "subagent_call" | "subagent_result" }>;
