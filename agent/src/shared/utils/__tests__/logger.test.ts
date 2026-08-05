import { Logger, logger } from "../logger";

describe("logger", () => {
  const spies: Array<ReturnType<typeof vi.spyOn>> = [];

  beforeEach(() => {
    spies.push(
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "debug").mockImplementation(() => {}),
    );
  });

  afterEach(() => {
    spies.forEach((spy) => {
      spy.mockRestore();
    });
    spies.length = 0;
  });

  test("exports a Logger instance with the standard log methods", () => {
    expect(logger).toBeInstanceOf(Logger);
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  test("log methods accept a string and meta without throwing", () => {
    expect(() => logger.info("info msg", { key: "value" })).not.toThrow();
    expect(() => logger.warn("warn msg", { key: "value" })).not.toThrow();
    expect(() => logger.error("error msg", { key: "value" })).not.toThrow();
    expect(() => logger.debug("debug msg", { key: "value" })).not.toThrow();
  });

  test("log methods accept Error objects as meta without throwing", () => {
    expect(() => logger.info("info", new Error("boom"))).not.toThrow();
    expect(() => logger.warn("warn", new Error("boom"))).not.toThrow();
    expect(() => logger.error("error", new Error("boom"))).not.toThrow();
    expect(() => logger.debug("debug", new Error("boom"))).not.toThrow();
  });

  test("routes levels to the matching console methods", () => {
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    logger.debug("d");
    expect(console.log).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    expect(console.debug).toHaveBeenCalled();
  });

  test("info logs the message to console.log", () => {
    logger.info("hello world");
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("hello world"));
  });

  test("telemetry does not throw", () => {
    expect(() =>
      logger.telemetry("turn_complete", {
        spanId: "span-1",
        sessionId: "session-1",
        input: { messages: [{}, {}, {}] },
        metadata: { monetary_cost_usd: 0.25 },
      }),
    ).not.toThrow();
  });

  test("telemetry handles missing payload fields", () => {
    expect(() => logger.telemetry("turn_complete", {})).not.toThrow();
  });

  test("agentActivity does not throw", () => {
    expect(() => logger.agentActivity("mission-12345678", "TASK_STARTED", "starting task")).not.toThrow();
  });

  test("langfuse does not throw", () => {
    expect(() => logger.langfuse("INFO", "trace event")).not.toThrow();
  });

  test("constructing a fresh Logger instance works", () => {
    const instance = new Logger();
    expect(() => instance.info("direct")).not.toThrow();
  });
});
