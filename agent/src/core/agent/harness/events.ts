import type { AgentStatus, Task } from "../../../shared/types";
import { PACKET_TYPES } from "./constants";
import type { AgentStatusTracker } from "./status-tracker";
import type { HarnessEvent, HarnessEventType } from "./types";

export interface HarnessEmitterDeps {
  getMissionId: () => string;
  getStatusTracker: () => AgentStatusTracker | undefined;
  systemNoticesEnabled: boolean;
}

export class HarnessEventEmitter {
  private stallEmitted = false;
  private lastActivityTimestamp = Date.now();

  constructor(private readonly deps: HarnessEmitterDeps) {}

  get lastActivityAt(): number {
    return this.lastActivityTimestamp;
  }

  private async sendBase(
    onPacket: (p: HarnessEvent) => Promise<void>,
    packet: { type: HarnessEventType } & Record<string, unknown>,
  ) {
    if (packet.type !== PACKET_TYPES.HEARTBEAT) {
      this.lastActivityTimestamp = Date.now();
      this.stallEmitted = false;
    }
    const agentStatus = this.deps.getStatusTracker()?.getStatus();
    await onPacket({
      missionId: this.deps.getMissionId(),
      ...packet,
      ...(agentStatus ? { agentStatus } : {}),
    });
  }

  async emitSystemNotice(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    code: string,
    message: string,
    level: "info" | "warning" | "error" = "warning",
  ) {
    if (this.deps.systemNoticesEnabled) {
      await this.sendBase(onPacket, { type: PACKET_TYPES.SYSTEM_NOTICE, step, payload: { level, code, message } });
    }
  }

  async emitMetadata(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    fields: {
      content?: string;
      strategy?: string;
      historyDepth?: number;
      toolsAvailable?: string[];
      objective?: string;
      maxIterations?: number;
      title?: string;
      summary?: string;
    },
  ) {
    await this.sendBase(onPacket, { type: PACKET_TYPES.METADATA, step, ...fields });
  }

  async emitStateChange(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    from: string,
    to: string,
    reason: string,
  ) {
    await this.sendBase(onPacket, { type: PACKET_TYPES.STATE_CHANGE, step, from, to, reason });
  }

  async emitDegraded(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    from: string,
    to: string,
    reason: string,
  ) {
    await this.sendBase(onPacket, { type: PACKET_TYPES.DEGRADED, step, from, to, reason });
  }

  async emitReasoning(onPacket: (p: HarnessEvent) => Promise<void>, step: number, content: string) {
    await this.sendBase(onPacket, { type: PACKET_TYPES.REASONING, step, content });
  }

  async emitContent(onPacket: (p: HarnessEvent) => Promise<void>, step: number, content: string) {
    await this.sendBase(onPacket, { type: PACKET_TYPES.CONTENT, step, content });
  }

  async emitUsage(onPacket: (p: HarnessEvent) => Promise<void>, step: number, usage: object) {
    await this.sendBase(onPacket, { type: PACKET_TYPES.USAGE, step, usage });
  }

  async emitToolCall(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    toolName: string,
    toolInput: Record<string, unknown>,
  ) {
    await this.sendBase(onPacket, { type: PACKET_TYPES.TOOL_CALL, step, toolName, toolInput });
  }

  async emitToolResult(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    toolName: string,
    content: string,
    toolResult?: unknown,
  ) {
    await this.sendBase(onPacket, { type: PACKET_TYPES.TOOL_RESULT, step, toolName, content, toolResult });
  }

  async emitToolSkip(onPacket: (p: HarnessEvent) => Promise<void>, step: number, toolName: string) {
    await this.sendBase(onPacket, { type: PACKET_TYPES.TOOL_SKIP, step, toolName });
  }

  async emitTodos(onPacket: (p: HarnessEvent) => Promise<void>, step: number, todos: Task[]) {
    await this.sendBase(onPacket, { type: PACKET_TYPES.TODO, step, todos });
  }

  async emitSubagentCall(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    name: string,
    instruction: string,
  ) {
    await this.sendBase(onPacket, {
      type: PACKET_TYPES.SUBAGENT_CALL,
      step,
      subagent: { name, instruction, status: "calling" },
    });
  }

  async emitSubagentResult(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    name: string,
    instruction: string,
    result: string,
    status: "completed" | "failed",
  ) {
    await this.sendBase(onPacket, {
      type: PACKET_TYPES.SUBAGENT_RESULT,
      step,
      subagent: { name, instruction, result, status },
    });
  }

  async emitProgress(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    phase: string,
    tokensUsed: number,
    tokensTotal: number,
  ) {
    await this.sendBase(onPacket, { type: PACKET_TYPES.PROGRESS, step, phase, tokensUsed, tokensTotal });
  }

  async emitHeartbeat(onPacket: (p: HarnessEvent) => Promise<void>, step: number) {
    await this.sendBase(onPacket, { type: PACKET_TYPES.HEARTBEAT, step });
  }

  async emitTurnComplete(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    completed: boolean,
    totalIterations: number,
    totalCost: number,
  ) {
    await this.sendBase(onPacket, { type: PACKET_TYPES.TURN_COMPLETE, step, completed, totalIterations, totalCost });
  }

  async markStalledIfNeeded(onPacket: (p: HarnessEvent) => Promise<void>, iteration: number): Promise<void> {
    const statusTracker = this.deps.getStatusTracker();
    if (this.stallEmitted || !statusTracker) return;
    const { changed, from, to } = statusTracker.markStalled();
    if (!changed) return;
    this.stallEmitted = true;
    await this.emitStateChange(onPacket, iteration, from, to, "stalled");
  }

  async emitDebug(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    rawSystemPrompt: string,
    currentHistoryLength: number,
    rawMessages: Array<{ role: string; content: string }>,
  ) {
    await this.sendBase(onPacket, {
      type: PACKET_TYPES.DEBUG,
      step,
      rawSystemPrompt,
      currentHistoryLength,
      rawMessages,
    });
  }

  async updateStatus(onPacket: (p: HarnessEvent) => Promise<void>, updates: Partial<AgentStatus>, step: number) {
    const statusTracker = this.deps.getStatusTracker();
    if (!statusTracker) return;
    const { changed, from, to } = statusTracker.update(updates);
    if (changed) {
      let reason = "transition";
      if (to === "degraded") {
        reason = "consecutive_tool_failures";
      } else if (to === "looping") {
        reason = "cosine_similarity_threshold";
      }
      await this.emitStateChange(onPacket, step, from, to, reason);
    }
  }
}
