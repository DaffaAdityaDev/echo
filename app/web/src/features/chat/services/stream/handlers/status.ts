import { CANCELLED_MESSAGE } from "../../../constants";
import type { Message, StreamPacket } from "../../../types";
import type { StreamStore } from "./types";

export function handleTurnComplete(
  lastMessage: Message,
  data: StreamPacket & { type: "turn_complete" },
  store: StreamStore,
): void {
  if (data.usage) {
    lastMessage.usage = data.usage;
    store.setCumulativeUsage(data.usage);
  }
  lastMessage.status = "complete";
  store.setAgentState("completed");
}

export function handleError(lastMessage: Message, data: StreamPacket & { type: "error" }, store: StreamStore): void {
  const errDetail = data.content || "Stream execution failed";

  if (errDetail === CANCELLED_MESSAGE) {
    // Disconnect-triggered cancellation: the mission is dead by design
    // (token safety). Surface it as an interrupted turn — partial content
    // stays, the UI offers to continue — not as a completed error.
    lastMessage.status = "interrupted";
    store.setAgentState("completed");
    return;
  }

  const currentContent = lastMessage.content || "";
  lastMessage.content = currentContent ? `${currentContent}\n\n[Error: ${errDetail}]` : `Error: ${errDetail}`;
  lastMessage.status = "complete";
  store.setAgentState("error");
}

export function handleMissionCompleted(
  lastMessage: Message,
  _data: StreamPacket & { type: "mission_completed" },
  store: StreamStore,
): void {
  lastMessage.status = "complete";
  store.setAgentState("completed");
}

export function handleHeartbeat(
  _lastMessage: Message,
  data: StreamPacket & { type: "heartbeat" },
  store: StreamStore,
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
): void {
  if (typeof data.step === "number") {
    const step = data.step;
    store.setAgentProgress((prev) => (prev ? { ...prev, iteration: step } : { iteration: step, totalIterations: 0 }));
  }
}
