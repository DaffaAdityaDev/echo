export interface BudgetConfig {
  enabled: boolean;
  enforceMaxSteps: boolean;
  maxSteps: number;
  enforceTimeout: boolean;
  maxDurationMs: number;
  enforceCostCap: boolean;
  maxCostUsd: number;
}

export class BudgetMonitor {
  private startTime: number;
  private config: BudgetConfig;

  constructor(config?: Partial<BudgetConfig>) {
    this.startTime = Date.now();
    this.config = {
      enabled: config?.enabled ?? true,
      enforceMaxSteps: config?.enforceMaxSteps ?? true,
      maxSteps: config?.maxSteps ?? 15,
      enforceTimeout: config?.enforceTimeout ?? true,
      maxDurationMs: config?.maxDurationMs ?? 120_000,
      enforceCostCap: config?.enforceCostCap ?? true,
      maxCostUsd: config?.maxCostUsd ?? 1.00,
    };
  }

  public checkBudget(currentStep: number, accumulatedCostUsd: number): {
    exceeded: boolean;
    reason?: 'MAX_STEPS_EXCEEDED' | 'TIMEOUT_EXCEEDED' | 'COST_CAP_EXCEEDED';
    message?: string;
  } {
    if (!this.config.enabled) {
      return { exceeded: false };
    }

    const elapsedTimeMs = Date.now() - this.startTime;

    if (this.config.enforceMaxSteps && currentStep >= this.config.maxSteps) {
      return {
        exceeded: true,
        reason: 'MAX_STEPS_EXCEEDED',
        message: `Mission halted: Maximum step limit of ${this.config.maxSteps} reached.`,
      };
    }

    if (this.config.enforceTimeout && elapsedTimeMs >= this.config.maxDurationMs) {
      return {
        exceeded: true,
        reason: 'TIMEOUT_EXCEEDED',
        message: `Mission halted: Execution timeout (${Math.round(this.config.maxDurationMs / 1000)}s) exceeded.`,
      };
    }

    if (this.config.enforceCostCap && accumulatedCostUsd >= this.config.maxCostUsd) {
      return {
        exceeded: true,
        reason: 'COST_CAP_EXCEEDED',
        message: `Mission halted: Budget cap ($${this.config.maxCostUsd.toFixed(2)}) exceeded (spent: $${accumulatedCostUsd.toFixed(4)}).`,
      };
    }

    return { exceeded: false };
  }

  public getElapsedTimeMs(): number {
    return Date.now() - this.startTime;
  }
}
