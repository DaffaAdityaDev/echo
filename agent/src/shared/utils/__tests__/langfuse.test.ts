import { AsyncLocalStorage } from "node:async_hooks";
import { CallbackHandler } from "@langfuse/langchain";
import { propagateAttributes, startObservation } from "@langfuse/tracing";
import type { Mock } from "vitest";
import { getLangChainCallbacks, langfuseStorage, startAgentTrace } from "../langfuse";
import { logger } from "../logger";

vi.mock("@langfuse/langchain", () => {
  function makeHandler() {
    return { type: "callback-handler" };
  }
  return { CallbackHandler: vi.fn(makeHandler) };
});

vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: vi.fn(),
  startObservation: vi.fn(),
}));

vi.mock("../../../config/env", () => ({
  ENV: { LANGFUSE_BASE_URL: "http://langfuse.test" },
}));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("langfuse utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("exports langfuseStorage as an AsyncLocalStorage", () => {
    expect(langfuseStorage).toBeInstanceOf(AsyncLocalStorage);
  });

  test("re-exports propagateAttributes", () => {
    expect(typeof propagateAttributes).toBe("function");
  });

  describe("startAgentTrace", () => {
    test("returns the observation from startObservation", () => {
      (startObservation as unknown as Mock).mockReturnValue({ traceId: "trace-1" });
      const trace = startAgentTrace("trace-1", "m1", "u1", "strategy-a", "objective");
      expect(startObservation).toHaveBeenCalledWith(
        "agent-run-mission",
        expect.objectContaining({
          input: "objective",
          metadata: { strategy: "strategy-a" },
          version: "5.0.0",
        }),
      );
      expect(trace).toEqual({ traceId: "trace-1" });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Trace started successfully"));
    });

    test("returns null when startObservation throws", () => {
      vi.mocked(startObservation).mockImplementation(() => {
        throw new Error("sdk down");
      });
      const trace = startAgentTrace("trace-1", "m1", "u1", "strategy-a", "objective");
      expect(trace).toBeNull();
      expect(logger.error).toHaveBeenCalledWith("❌ Failed to start Agent Trace:", expect.any(Error));
    });
  });

  describe("getLangChainCallbacks", () => {
    test("returns the callback handler", async () => {
      const callbacks = await getLangChainCallbacks();
      expect(CallbackHandler).toHaveBeenCalled();
      expect(callbacks).toHaveLength(1);
    });

    test("returns empty when CallbackHandler throws", async () => {
      vi.mocked(CallbackHandler).mockImplementation(() => {
        throw new Error("no sdk");
      });
      const callbacks = await getLangChainCallbacks();
      expect(callbacks).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
