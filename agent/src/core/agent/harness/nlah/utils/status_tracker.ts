import { AgentStatus } from '../../../../../shared/types';

export class AgentStatusTracker {
  private status: AgentStatus;

  constructor(step: number, maxSteps: number, strategy: 'agent' | 'standard' | 'restricted') {
    this.status = {
      state: 'starting',
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
      activeCircuitBreakers: this.status.activeCircuitBreakers 
        ? [...this.status.activeCircuitBreakers] 
        : [],
    };
  }

  update(updates: Partial<AgentStatus>): { changed: boolean; from: string; to: string } {
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
}
