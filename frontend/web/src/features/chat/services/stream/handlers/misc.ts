import { PACKET_TYPES } from "../../../constants";
import type { Message, MissionMeta, StreamPacket, SystemNotice } from "../../../types";
import type { StreamHandlerOptions, StreamStore } from "./types";

export function handleMetadata(
  lastMessage: Message,
  data: StreamPacket & { type: "metadata" },
  store: StreamStore,
  _opts: StreamHandlerOptions,
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

export function handleDebug(
  _lastMessage: Message,
  data: StreamPacket & { type: "debug" },
  store: StreamStore,
  _opts: StreamHandlerOptions,
): void {
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
  _opts: StreamHandlerOptions,
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
  opts: StreamHandlerOptions,
): void {
  const expiresAt = data.payload.expiresAt;
  if (opts.replay && expiresAt && Date.now() > expiresAt) return;
  store.setHitlPendingApproval({
    approvalId: data.payload.approvalId,
    toolName: data.payload.toolName,
    args: data.payload.args,
    riskLevel: data.payload.riskLevel,
    expiresAt,
    missionId: data.missionId,
  });
}

export function handleReplayDone(
  _lastMessage: Message,
  _data: StreamPacket,
  _store: StreamStore,
  _opts: StreamHandlerOptions,
): void {
  // Replay marker is handled by the caller before this point; nothing to apply.
}

export function handleDefault(
  lastMessage: Message,
  data: StreamPacket,
  _store: StreamStore,
  opts: StreamHandlerOptions,
): void {
  if (opts.replay) return;
  const streamRecord = data as unknown as {
    choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
    content?: string;
    reasoning_content?: string;
  };
  const delta = streamRecord.choices?.[0]?.delta || streamRecord;
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
