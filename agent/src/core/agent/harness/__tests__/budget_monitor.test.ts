import { BudgetMonitor } from "../budget_monitor";

describe("BudgetMonitor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("disabled config returns exceeded=false", () => {
    const m = new BudgetMonitor({ enabled: false });
    expect(m.checkBudget(999, 999)).toEqual({ exceeded: false });
  });

  it("within budget returns exceeded=false", () => {
    const m = new BudgetMonitor({
      enabled: true,
      maxSteps: 10,
      maxDurationMs: 60000,
      maxCostUsd: 1.0,
    });
    expect(m.checkBudget(5, 0.5)).toEqual({ exceeded: false });
  });

  it("exceeding max steps returns MAX_STEPS_EXCEEDED", () => {
    const m = new BudgetMonitor({ enabled: true, maxSteps: 5, enforceMaxSteps: true });
    const r = m.checkBudget(5, 0);
    expect(r.exceeded).toBe(true);
    expect(r.reason).toBe("MAX_STEPS_EXCEEDED");
    expect(r.message).toContain("Maximum step limit");
  });

  it("max steps check uses >= (step 0 based or not)", () => {
    const m = new BudgetMonitor({ enabled: true, maxSteps: 0, enforceMaxSteps: true });
    const r = m.checkBudget(0, 0);
    expect(r.exceeded).toBe(true);
    expect(r.reason).toBe("MAX_STEPS_EXCEEDED");
  });

  it("exceeding timeout returns TIMEOUT_EXCEEDED", () => {
    const m = new BudgetMonitor({ enabled: true, maxDurationMs: 100_000, enforceTimeout: true });
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 200_000);
    const r = m.checkBudget(1, 0);
    expect(r.exceeded).toBe(true);
    expect(r.reason).toBe("TIMEOUT_EXCEEDED");
    expect(r.message).toContain("timeout");
  });

  it("within timeout returns normal", () => {
    const m = new BudgetMonitor({ enabled: true, maxDurationMs: 100_000, enforceTimeout: true });
    const r = m.checkBudget(1, 0);
    expect(r.exceeded).toBe(false);
  });

  it("exceeding cost cap returns COST_CAP_EXCEEDED", () => {
    const m = new BudgetMonitor({ enabled: true, maxCostUsd: 1.0, enforceCostCap: true });
    const r = m.checkBudget(1, 1.5);
    expect(r.exceeded).toBe(true);
    expect(r.reason).toBe("COST_CAP_EXCEEDED");
    expect(r.message).toContain("Budget cap");
  });

  it("cost cap uses >= comparison", () => {
    const m = new BudgetMonitor({ enabled: true, maxCostUsd: 1.0, enforceCostCap: true });
    const r = m.checkBudget(1, 1.0);
    expect(r.exceeded).toBe(true);
    expect(r.reason).toBe("COST_CAP_EXCEEDED");
  });

  it("within cost cap returns normal", () => {
    const m = new BudgetMonitor({ enabled: true, maxCostUsd: 1.0, enforceCostCap: true });
    const r = m.checkBudget(1, 0.99);
    expect(r.exceeded).toBe(false);
  });

  it("getElapsedTimeMs returns positive number", () => {
    const m = new BudgetMonitor();
    expect(m.getElapsedTimeMs()).toBeGreaterThanOrEqual(0);
  });

  it("steps are checked before timeout and cost", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 999_999);
    const m = new BudgetMonitor({
      enabled: true,
      maxSteps: 5,
      maxDurationMs: 1,
      maxCostUsd: 0.01,
      enforceMaxSteps: true,
      enforceTimeout: true,
      enforceCostCap: true,
    });
    const r = m.checkBudget(5, 999);
    expect(r.reason).toBe("MAX_STEPS_EXCEEDED");
  });
});
