import type { Message, StreamPacket } from "../../../types";
import type { StreamHandlerOptions, StreamStore } from "./types";

export function handleTurnComplete(
  lastMessage: Message,
  data: StreamPacket & { type: "turn_complete" },
  store: StreamStore,
  _opts: StreamHandlerOptions,
): void {
  if (data.usage) {
    lastMessage.usage = data.usage;
    store.setCumulativeUsage(data.usage);
  }
  lastMessage.status = "complete";
  store.setAgentState("completed");
}

export function handleError(
  lastMessage: Message,
  data: StreamPacket & { type: "error" },
  store: StreamStore,
  _opts: StreamHandlerOptions,
): void {
  const errDetail = data.content || "Stream execution failed";
  const currentContent = lastMessage.content || "";
  lastMessage.content = currentContent ? `${currentContent}\n\n[Error: ${errDetail}]` : `Error: ${errDetail}`;
  lastMessage.status = "complete";
  store.setAgentState("error");
}

export function handleMissionCompleted(
  lastMessage: Message,
  _data: StreamPacket & { type: "mission_completed" },
  store: StreamStore,
  _opts: StreamHandlerOptions,
): void {
  lastMessage.status = "complete";
  store.setAgentState("completed");
}

export function handleHeartbeat(
  _lastMessage: Message,
  data: StreamPacket & { type: "heartbeat" },
  store: StreamStore,
  _opts: StreamHandlerOptions,
): void {
  if (data.agentStatus) {
    store.setAgentProgress((prev) =>
      prev
        ? { ...prev, agentStatus: data.agentStatus }
        : { iteration: 0, totalIterations: 0, agentStatus: data.agentStatus },
    );
  }
}

export function handleProgress(
  _lastMessage: Message,
  data: StreamPacket & { type: "progress" },
  store: StreamStore,
  _opts: StreamHandlerOptions,
): void {
  if (typeof data.step === "number") {
    const step = data.step;
    store.setAgentProgress((prev) => (prev ? { ...prev, iteration: step } : { iteration: step, totalIterations: 0 }));
  }
}
