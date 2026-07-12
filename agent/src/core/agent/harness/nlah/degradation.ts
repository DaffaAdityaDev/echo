import { HARNESS_CONFIG } from './constants';

export type DegradationLevel = 'normal' | 'restricted' | 'standard';

export class DegradationManager {
  private consecutiveFailedIterations = 0;
  private degradeAfter: number;
  private abortAfter: number;

  constructor(config?: { degradeAfter?: number; abortAfter?: number }) {
    const degConfig = (HARNESS_CONFIG as any).DEGRADATION;
    this.degradeAfter = config?.degradeAfter ?? degConfig?.DEGRADE_AFTER ?? 3;
    this.abortAfter = config?.abortAfter ?? degConfig?.ABORT_AFTER ?? 7;
  }

  recordToolError(): DegradationLevel {
    this.consecutiveFailedIterations++;
    return this.getLevel();
  }

  reset(): void {
    this.consecutiveFailedIterations = 0;
  }

  getLevel(): DegradationLevel {
    if (this.consecutiveFailedIterations >= this.degradeAfter && this.consecutiveFailedIterations < 5) {
      return 'restricted';
    }
    if (this.consecutiveFailedIterations >= 5) {
      return 'standard';
    }
    return 'normal';
  }

  isDegraded(): boolean {
    return this.getLevel() !== 'normal';
  }

  shouldAbort(): boolean {
    return this.consecutiveFailedIterations >= this.abortAfter;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailedIterations;
  }
}
