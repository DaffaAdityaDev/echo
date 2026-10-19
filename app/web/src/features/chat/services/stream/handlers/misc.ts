import { PACKET_TYPES } from "../../../constants";
import type { Message, MissionMeta, StreamPacket, SystemNotice } from "../../../types";
import type { StreamStore } from "./types";

export function handleMetadata(
  lastMessage: Message,
  data: StreamPacket & { type: "metadata" },
  store: StreamStore,
): void {
  const meta: MissionMeta = data.meta || {
    strategy: data.strategy,
    historyDepth: data.historyDepth,
    toolsAvailable: data.toolsAvailable,
    objective: data.objective,
    maxIterations: data.maxIterations,
  };

  lastMessage.meta = meta;
  store.setMissionMeta(meta);
}

export function handleDebug(_lastMessage: Message, data: StreamPacket & { type: "debug" }, store: StreamStore): void {
  store.appendDebugInfo({
    systemPrompt: data.rawSystemPrompt,
    historyLength: data.currentHistoryLength,
    rawMessages: data.rawMessages,
    missionId: data.missionId,
    timestamp: data.timestamp,
  });
}

export function handleSystemNotice(
  _lastMessage: Message,
  data: StreamPacket & { type: "system_notice" },
  store: StreamStore,
): void {
  const notice: SystemNotice = {
    id: crypto.randomUUID(),
    level: data.payload.level,
    code: data.payload.code,
    message: data.payload.message,
    timestamp: Date.now(),
  };

  store.appendSystemNotice(notice);
}

export function handleHitlApproval(
  _lastMessage: Message,
  data: StreamPacket & { type: "hitl_approval_required" },
  store: StreamStore,
): void {
  store.setHitlPendingApproval({
    approvalId: data.payload.approvalId,
    toolName: data.payload.toolName,
    args: data.payload.args,
    riskLevel: data.payload.riskLevel,
    expiresAt: data.payload.expiresAt,
    // The agent's run id in the packet is the session id at the top level.
    sessionId: data.missionId,
  });
}

export function handleDefault(lastMessage: Message, data: StreamPacket, _store: StreamStore): void {
  if (!isRawDelta(data)) return;
  const delta = data.choices?.[0]?.delta ?? data;
  const content = delta.content || "";
  const reasoning = delta.reasoning_content || "";

  if (reasoning) {
    const lastStep = lastMessage.steps[lastMessage.steps.length - 1];

    if (lastStep?.type === PACKET_TYPES.REASONING) {
      lastMessage.steps[lastMessage.steps.length - 1] = {
        ...lastStep,
        content: (lastStep.content || "") + reasoning,
      };
    } else {
      lastMessage.steps.push({ type: PACKET_TYPES.REASONING, content: reasoning });
    }
  }

  if (content) {
    lastMessage.content = (lastMessage.content || "") + content;
  }
}

interface RawStreamDelta {
  choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
  content?: string;
  reasoning_content?: string;
}

function isRawDelta(packet: StreamPacket): packet is StreamPacket & RawStreamDelta {
  // SAFETY: StreamPacket in legacy SSE streams may embed raw choices or delta fields
  const candidate = packet as StreamPacket & RawStreamDelta;

  if (typeof candidate.content === "string" || typeof candidate.reasoning_content === "string") {
    return true;
  }

  if (!Array.isArray(candidate.choices) || candidate.choices.length === 0) {
    return false;
  }

  const choice = candidate.choices[0];
  const delta = choice?.delta;

  return typeof delta?.content === "string" || typeof delta?.reasoning_content === "string";
}
