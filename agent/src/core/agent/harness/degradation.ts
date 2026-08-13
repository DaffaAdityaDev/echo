import { HARNESS_CONFIG } from "./constants";

export type DegradationLevel = "normal" | "restricted" | "standard";

export class DegradationManager {
  private consecutiveFailedIterations = 0;
  private degradeAfter: number;
  private standardAfter: number;
  private abortAfter: number;

  constructor(config?: { degradeAfter?: number; abortAfter?: number }) {
    const degConfig = HARNESS_CONFIG.DEGRADATION;
    this.degradeAfter = config?.degradeAfter ?? degConfig?.DEGRADE_AFTER ?? 3;
    this.abortAfter = config?.abortAfter ?? degConfig?.ABORT_AFTER ?? 7;
    // The "standard" tier sits halfway between degrade and abort, so all
    // tiers stay reachable for any config (hardcoded 5 broke configs where
    // degradeAfter >= 5 or abortAfter < 5).
    this.standardAfter = Math.floor((this.degradeAfter + this.abortAfter) / 2);
  }

  recordToolError(): DegradationLevel {
    this.consecutiveFailedIterations++;
    return this.getLevel();
  }

  reset(): void {
    this.consecutiveFailedIterations = 0;
  }

  getLevel(): DegradationLevel {
    if (this.consecutiveFailedIterations < this.degradeAfter) {
      return "normal";
    }
    if (this.consecutiveFailedIterations < this.standardAfter) {
      return "restricted";
    }
    return "standard";
  }

  isDegraded(): boolean {
    return this.getLevel() !== "normal";
  }

  shouldAbort(): boolean {
    return this.consecutiveFailedIterations >= this.abortAfter;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailedIterations;
  }
}
