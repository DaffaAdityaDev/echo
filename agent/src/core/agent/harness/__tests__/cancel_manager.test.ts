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

  it("unregister removes controller from tracking", () => {
    manager.register("cm-unregister-test");
    manager.unregister("cm-unregister-test");
    expect(manager.isAborted("cm-unregister-test")).toBe(false);
  });

  it("isAborted returns false for unknown mission", () => {
    expect(manager.isAborted("cm-unknown")).toBe(false);
  });
});
