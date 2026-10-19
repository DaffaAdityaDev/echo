import type { AgentStatus } from "../../../shared/types";

export interface StatusTransition {
  changed: boolean;
  from: string;
  to: string;
}

export class AgentStatusTracker {
  private status: AgentStatus;

  constructor(step: number, maxSteps: number, strategy: "agent" | "standard" | "restricted") {
    this.status = {
      state: "starting",
      step,
      maxSteps,
      strategy,
      lastActivity: new Date().toISOString(),
      consecutiveFailures: 0,
      activeCircuitBreakers: [],
    };
  }

  getStatus(): AgentStatus {
    // Return a shallow copy of status, ensuring lists are copied too
    return {
      ...this.status,
      activeCircuitBreakers: this.status.activeCircuitBreakers ? [...this.status.activeCircuitBreakers] : [],
    };
  }

  update(updates: Partial<AgentStatus>): StatusTransition {
    const from = this.status.state;

    this.status = {
      ...this.status,
      ...updates,
      lastActivity: new Date().toISOString(),
    };

    const to = this.status.state;
    const changed = from !== to;

    return { changed, from, to };
  }

  markStalled(): StatusTransition {
    const from = this.status.state;

    if (from === "completed" || from === "aborted" || from === "stalled" || from === "awaiting_approval") {
      return { changed: false, from, to: from };
    }

    this.status = {
      ...this.status,
      state: "stalled",
      lastActivity: new Date().toISOString(),
    };

    return { changed: true, from, to: "stalled" };
  }
}
