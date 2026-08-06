import type { AgentStatus } from "../../../shared/types";
import type { AgentStatusTracker } from "./status-tracker";
import type { HarnessEvent } from "./types";

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
    packet: { type: string } & Record<string, unknown>,
  ) {
    if (packet.type !== "heartbeat") {
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
      await this.sendBase(onPacket, { type: "system_notice", step, payload: { level, code, message } });
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
    await this.sendBase(onPacket, { type: "metadata", step, ...fields });
  }

  async emitStateChange(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    from: string,
    to: string,
    reason: string,
  ) {
    await this.sendBase(onPacket, { type: "state_change", step, from, to, reason });
  }

  async emitDegraded(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    from: string,
    to: string,
    reason: string,
  ) {
    await this.sendBase(onPacket, { type: "degraded", step, from, to, reason });
  }

  async emitReasoning(onPacket: (p: HarnessEvent) => Promise<void>, step: number, content: string) {
    await this.sendBase(onPacket, { type: "reasoning", step, content });
  }

  async emitContent(onPacket: (p: HarnessEvent) => Promise<void>, step: number, content: string) {
    await this.sendBase(onPacket, { type: "content", step, content });
  }

  async emitUsage(onPacket: (p: HarnessEvent) => Promise<void>, step: number, usage: object) {
    await this.sendBase(onPacket, { type: "usage", step, usage });
  }

  async emitToolCall(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    toolName: string,
    toolInput: Record<string, unknown>,
  ) {
    await this.sendBase(onPacket, { type: "tool_call", step, toolName, toolInput });
  }

  async emitToolResult(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    toolName: string,
    content: string,
    toolResult?: unknown,
  ) {
    await this.sendBase(onPacket, { type: "tool_result", step, toolName, content, toolResult });
  }

  async emitToolSkip(onPacket: (p: HarnessEvent) => Promise<void>, step: number, toolName: string) {
    await this.sendBase(onPacket, { type: "tool_skip", step, toolName });
  }

  async emitTodos(onPacket: (p: HarnessEvent) => Promise<void>, step: number, todos: unknown) {
    await this.sendBase(onPacket, { type: "todo", step, todos });
  }

  async emitSubagentCall(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    name: string,
    instruction: string,
  ) {
    await this.sendBase(onPacket, { type: "subagent_call", step, subagent: { name, instruction, status: "calling" } });
  }

  async emitSubagentResult(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    name: string,
    instruction: string,
    result: string,
    status: "completed" | "failed",
  ) {
    await this.sendBase(onPacket, { type: "subagent_result", step, subagent: { name, instruction, result, status } });
  }

  async emitProgress(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    phase: string,
    tokensUsed: number,
    tokensTotal: number,
  ) {
    await this.sendBase(onPacket, { type: "progress", step, phase, tokensUsed, tokensTotal });
  }

  async emitHeartbeat(onPacket: (p: HarnessEvent) => Promise<void>, step: number) {
    await this.sendBase(onPacket, { type: "heartbeat", step });
  }

  async emitTurnComplete(
    onPacket: (p: HarnessEvent) => Promise<void>,
    step: number,
    completed: boolean,
    totalIterations: number,
    totalCost: number,
  ) {
    await this.sendBase(onPacket, { type: "turn_complete", step, completed, totalIterations, totalCost });
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
    await this.sendBase(onPacket, { type: "debug", step, rawSystemPrompt, currentHistoryLength, rawMessages });
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
