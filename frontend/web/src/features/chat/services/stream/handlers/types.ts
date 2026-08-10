import type { useChatStore } from "../../../stores/chatStore";
import type { StreamPacket } from "../../../types";

export type StreamStore = ReturnType<typeof useChatStore.getState>;

export type SubagentPacket = Extract<StreamPacket, { type: "subagent_call" | "subagent_result" }>;
