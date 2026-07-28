import { DEFAULT_PROTECTED_TOOLS, HitlGuard } from "../hitl_guard";

describe("HitlGuard", () => {
  it("isEnabled returns true by default", () => {
    expect(new HitlGuard().isEnabled()).toBe(true);
  });

  it("isEnabled reflects config", () => {
    expect(new HitlGuard({ enabled: false }).isEnabled()).toBe(false);
    expect(new HitlGuard({ enabled: true }).isEnabled()).toBe(true);
  });

  it("isProtected returns true for default protected tools", () => {
    const g = new HitlGuard();
    for (const tool of DEFAULT_PROTECTED_TOOLS) {
      expect(g.isProtected(tool)).toBe(true);
    }
  });

  it("isProtected returns false for non-protected tools", () => {
    const g = new HitlGuard();
    expect(g.isProtected("web_search")).toBe(false);
    expect(g.isProtected("read_file")).toBe(false);
  });

  it("isProtected always returns false when disabled", () => {
    const g = new HitlGuard({ enabled: false });
    expect(g.isProtected("execute_sql_write")).toBe(false);
  });

  it("custom protectedTools override defaults", () => {
    const g = new HitlGuard({ protectedTools: ["deploy_infrastructure", "custom_tool"] });
    expect(g.isProtected("deploy_infrastructure")).toBe(true);
    expect(g.isProtected("custom_tool")).toBe(true);
    expect(g.isProtected("execute_sql_write")).toBe(false);
    expect(g.isProtected("delete_file")).toBe(false);
  });

  it("empty protectedTools array means nothing is protected", () => {
    const g = new HitlGuard({ protectedTools: [] });
    expect(g.isProtected("execute_sql_write")).toBe(false);
    expect(g.isProtected("delete_file")).toBe(false);
  });

  it("createApprovalPayload generates correct structure", () => {
    const g = new HitlGuard({ ttlMinutes: 10 });
    const payload = g.createApprovalPayload("mission_1", "session_1", {
      id: "call_abc",
      name: "execute_sql_write",
      args: { query: "DROP TABLE users" },
    });

    expect(payload.approvalId).toMatch(/^appr_/);
    expect(payload.missionId).toBe("mission_1");
    expect(payload.sessionId).toBe("session_1");
    expect(payload.toolCall.id).toBe("call_abc");
    expect(payload.toolCall.name).toBe("execute_sql_write");
    expect(payload.toolCall.args).toEqual({ query: "DROP TABLE users" });
    expect(payload.createdAt).toBeGreaterThan(0);
    expect(payload.expiresAt - payload.createdAt).toBe(10 * 60 * 1000);
  });

  it("createApprovalPayload uses default TTL of 5 minutes", () => {
    const g = new HitlGuard();
    const payload = g.createApprovalPayload("m", "s", { id: "c", name: "t", args: {} });
    expect(payload.expiresAt - payload.createdAt).toBe(5 * 60 * 1000);
  });

  it("approvalId starts with appr_", () => {
    const g = new HitlGuard();
    const p1 = g.createApprovalPayload("m", "s", { id: "c", name: "t", args: {} });
    const p2 = g.createApprovalPayload("m", "s", { id: "c", name: "t", args: {} });
    expect(p1.approvalId).not.toBe(p2.approvalId);
  });
});
