import { logger } from "../../../../shared/utils/logger";
import { CancellationManager } from "../cancel_manager";

describe("CancellationManager", () => {
  let manager: CancellationManager;

  beforeAll(() => {
    vi.spyOn(logger, "info").mockImplementation(() => {});
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    vi.spyOn(logger, "error").mockImplementation(() => {});
    manager = CancellationManager.getInstance();
  });

  it("register creates controller that is not aborted", () => {
    const signal = manager.register("cm-register-test");
    expect(signal.aborted).toBe(false);
    expect(manager.isAborted("cm-register-test")).toBe(false);
    manager.unregister("cm-register-test");
  });

  it("cancelLocal aborts the signal for a registered mission", () => {
    const signal = manager.register("cm-cancel-test");
    manager.cancelLocal("cm-cancel-test");
    expect(signal.aborted).toBe(true);
  });

  it("cancelLocal on unknown mission does not throw", () => {
    expect(() => manager.cancelLocal("cm-nonexistent")).not.toThrow();
  });

  it("cancelLocal on unregistered mission still marks it cancelled (pre-register window)", () => {
    manager.cancelLocal("cm-unregistered-mark");
    expect(manager.isCancelled("cm-unregistered-mark")).toBe(true);
    manager.clearCancelled("cm-unregistered-mark");
  });

  it("unregister removes controller from tracking", () => {
    manager.register("cm-unregister-test");
    manager.unregister("cm-unregister-test");
    expect(manager.isAborted("cm-unregister-test")).toBe(false);
  });

  it("isAborted returns false for unknown mission", () => {
    expect(manager.isAborted("cm-unknown")).toBe(false);
  });

  it("getSignal returns the live signal while registered", () => {
    const signal = manager.register("cm-signal-test");
    expect(manager.getSignal("cm-signal-test")).toBe(signal);
    manager.unregister("cm-signal-test");
    expect(manager.getSignal("cm-signal-test")).toBeUndefined();
  });

  it("cancelLocal marks the mission cancelled and getSignal goes away", () => {
    manager.register("cm-cancelled-test");
    manager.cancelLocal("cm-cancelled-test");
    expect(manager.isCancelled("cm-cancelled-test")).toBe(true);
    expect(manager.getSignal("cm-cancelled-test")).toBeUndefined();
  });

  it("clearCancelled resets the cancelled mark (new turn on same session)", () => {
    manager.register("cm-clear-test");
    manager.cancelLocal("cm-clear-test");
    expect(manager.isCancelled("cm-clear-test")).toBe(true);
    manager.clearCancelled("cm-clear-test");
    expect(manager.isCancelled("cm-clear-test")).toBe(false);
    manager.unregister("cm-clear-test");
  });
});
