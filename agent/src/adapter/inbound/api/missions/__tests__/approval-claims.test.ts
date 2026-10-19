import { ApprovalClaimRegistry } from "../approval-claims";

describe("ApprovalClaimRegistry", () => {
  test("grants a claim only once while it is retained", () => {
    const registry = new ApprovalClaimRegistry(1000);

    expect(registry.tryClaim("appr_1", 0)).toBe(true);
    expect(registry.tryClaim("appr_1", 999)).toBe(false);
    expect(registry.tryClaim("appr_2", 999)).toBe(true);
  });

  test("releases a claim after the retention window", () => {
    const registry = new ApprovalClaimRegistry(1000);

    expect(registry.tryClaim("appr_1", 0)).toBe(true);
    expect(registry.tryClaim("appr_1", 1000)).toBe(true);
  });

  test("a released claim can be claimed again", () => {
    const registry = new ApprovalClaimRegistry(1000);

    expect(registry.tryClaim("appr_1", 0)).toBe(true);
    registry.release("appr_1");
    expect(registry.tryClaim("appr_1", 1)).toBe(true);
  });
});
