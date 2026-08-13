import { DegradationManager } from "../degradation";

describe("DegradationManager", () => {
  it("default level is normal", () => {
    const manager = new DegradationManager();
    expect(manager.getLevel()).toBe("normal");
    expect(manager.isDegraded()).toBe(false);
    expect(manager.shouldAbort()).toBe(false);
  });

  it("3 failures makes level restricted", () => {
    const manager = new DegradationManager({ degradeAfter: 3, abortAfter: 7 });
    for (let i = 0; i < 3; i++) manager.recordToolError();
    expect(manager.getLevel()).toBe("restricted");
    expect(manager.isDegraded()).toBe(true);
    expect(manager.shouldAbort()).toBe(false);
  });

  it("5 failures makes level standard", () => {
    const manager = new DegradationManager({ degradeAfter: 3, abortAfter: 7 });
    for (let i = 0; i < 5; i++) manager.recordToolError();
    expect(manager.getLevel()).toBe("standard");
    expect(manager.isDegraded()).toBe(true);
    expect(manager.shouldAbort()).toBe(false);
  });

  it("7 failures triggers abort", () => {
    const manager = new DegradationManager({ degradeAfter: 3, abortAfter: 7 });
    for (let i = 0; i < 7; i++) manager.recordToolError();
    expect(manager.shouldAbort()).toBe(true);
  });

  it("reset restores level to normal", () => {
    const manager = new DegradationManager({ degradeAfter: 3, abortAfter: 7 });
    for (let i = 0; i < 4; i++) manager.recordToolError();
    expect(manager.getLevel()).toBe("restricted");

    manager.reset();
    expect(manager.getLevel()).toBe("normal");
    expect(manager.isDegraded()).toBe(false);
    expect(manager.shouldAbort()).toBe(false);
    expect(manager.getConsecutiveFailures()).toBe(0);
  });

  it("keeps restricted reachable when degradeAfter >= 5", () => {
    const manager = new DegradationManager({ degradeAfter: 5, abortAfter: 9 });
    for (let i = 0; i < 5; i++) manager.recordToolError();
    expect(manager.getLevel()).toBe("restricted");
    expect(manager.isDegraded()).toBe(true);
    expect(manager.shouldAbort()).toBe(false);

    manager.recordToolError();
    expect(manager.getLevel()).toBe("restricted");

    manager.recordToolError();
    expect(manager.getLevel()).toBe("standard");
    expect(manager.shouldAbort()).toBe(false);
  });

  it("still fires standard before abort when abortAfter < 5", () => {
    const manager = new DegradationManager({ degradeAfter: 2, abortAfter: 4 });
    for (let i = 0; i < 2; i++) manager.recordToolError();
    expect(manager.getLevel()).toBe("restricted");

    manager.recordToolError();
    expect(manager.getLevel()).toBe("standard");
    expect(manager.shouldAbort()).toBe(false);

    manager.recordToolError();
    expect(manager.shouldAbort()).toBe(true);
  });
});
