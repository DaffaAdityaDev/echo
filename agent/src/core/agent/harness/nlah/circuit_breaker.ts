import { HARNESS_CONFIG } from './constants';

export interface CircuitState {
  failures: number;
  lastFailureAt: number;
  state: 'closed' | 'open';
}

export class CircuitBreaker {
  private states = new Map<string, CircuitState>();
  private openAfter: number;
  private maxRetriesPerTool: number;

  constructor(config?: { openAfter?: number; maxRetriesPerTool?: number }) {
    const cbConfig = (HARNESS_CONFIG as any).CIRCUIT_BREAKER;
    this.openAfter = config?.openAfter ?? cbConfig?.OPEN_AFTER ?? 3;
    this.maxRetriesPerTool = config?.maxRetriesPerTool ?? cbConfig?.MAX_RETRIES_PER_TOOL ?? 3;
  }

  isOpen(toolName: string): boolean {
    const state = this.states.get(toolName);
    if (!state) return false;
    return state.state === 'open';
  }

  recordSuccess(toolName: string): void {
    const state = this.states.get(toolName);
    if (state) {
      state.failures = 0;
      state.state = 'closed';
    }
  }

  recordFailure(toolName: string): boolean {
    let state = this.states.get(toolName);
    if (!state) {
      state = { failures: 0, lastFailureAt: 0, state: 'closed' };
      this.states.set(toolName, state);
    }
    state.failures++;
    state.lastFailureAt = Date.now();

    if (state.failures >= this.openAfter || state.failures >= this.maxRetriesPerTool) {
      state.state = 'open';
    }
    return state.state === 'open';
  }

  reset(): void {
    this.states.clear();
  }

  getState(toolName: string): CircuitState | undefined {
    return this.states.get(toolName);
  }

  getAllOpenCircuits(): string[] {
    const open: string[] = [];
    for (const [tool, state] of this.states.entries()) {
      if (state.state === 'open') {
        open.push(tool);
      }
    }
    return open;
  }
}
