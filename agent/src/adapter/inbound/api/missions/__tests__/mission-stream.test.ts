import type Redis from "ioredis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setRedisClientForTest } from "../../../../../infrastructure/cache/redis";
import { getHistory, getLastEvent, isTerminalPacket, recordEvent, subscribe } from "../mission-stream";

type FakeRedis = Pick<Redis, "xadd" | "xrange" | "xread" | "xrevrange" | "expire">;

function createFakeRedis(): FakeRedis {
  return {
    xadd: vi.fn().mockResolvedValue("1699999999999-0"),
    xrange: vi.fn().mockResolvedValue([]),
    xread: vi.fn().mockResolvedValue(null),
    xrevrange: vi.fn().mockResolvedValue([]),
    expire: vi.fn().mockResolvedValue(1),
  } as unknown as FakeRedis;
}

describe("mission-stream (Redis)", () => {
  let fake: FakeRedis;

  beforeEach(() => {
    fake = createFakeRedis();
    __setRedisClientForTest(fake as unknown as Redis, true);
  });

  afterEach(() => {
    __setRedisClientForTest(null, false);
    vi.restoreAllMocks();
  });

  describe("recordEvent", () => {
    it("writes the packet into the mission stream with MAXLEN + TTL", async () => {
      const packet = { type: "content", content: "hello" };
      await recordEvent("m-1", packet);

      expect(fake.xadd).toHaveBeenCalledWith(
        "mission:events:m-1",
        "MAXLEN",
        "~",
        2000,
        "*",
        "p",
        JSON.stringify(packet),
      );
      expect(fake.expire).toHaveBeenCalledWith("mission:events:m-1", 86400);
    });

    it("does not throw when redis is unavailable", async () => {
      __setRedisClientForTest(null, false);
      await expect(recordEvent("m-1", { type: "content" })).resolves.toBeUndefined();
    });

    it("swallows write failures without throwing", async () => {
      (fake.xadd as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("boom"));
      await expect(recordEvent("m-1", { type: "content" })).resolves.toBeUndefined();
    });
  });

  describe("getHistory", () => {
    it("parses xrange entries into {sid, packet}", async () => {
      (fake.xrange as ReturnType<typeof vi.fn>).mockResolvedValue([
        ["1699999999999-0", ["p", '{"type":"content","content":"a"}']],
        ["1699999999999-1", ["p", '{"type":"tool_call","toolName":"web_search"}']],
      ]);

      const events = await getHistory("m-1");
      expect(events).toEqual([
        { sid: "1699999999999-0", packet: { type: "content", content: "a" } },
        { sid: "1699999999999-1", packet: { type: "tool_call", toolName: "web_search" } },
      ]);
      expect(fake.xrange).toHaveBeenCalledWith("mission:events:m-1", "-", "+");
    });

    it("uses exclusive cursor when after is provided", async () => {
      await getHistory("m-1", "1699999999999-5");
      expect(fake.xrange).toHaveBeenCalledWith("mission:events:m-1", "(1699999999999-5", "+");
    });

    it("returns [] when redis is unavailable", async () => {
      __setRedisClientForTest(null, false);
      await expect(getHistory("m-1")).resolves.toEqual([]);
    });
  });

  describe("subscribe", () => {
    it("forwards live entries to the callback with sid", async () => {
      const cb = vi.fn();
      (fake.xread as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          ["mission:events:m-1", [["1699999999999-2", ["p", '{"type":"content","content":"live"}']]]],
        ])
        .mockResolvedValue(null);

      const unsubscribe = subscribe("m-1", cb);
      await vi.waitFor(() => expect(cb).toHaveBeenCalledTimes(1));

      expect(cb).toHaveBeenCalledWith({
        sid: "1699999999999-2",
        packet: { type: "content", content: "live" },
      });
      unsubscribe();
    });

    it("stops the loop after unsubscribe", async () => {
      const cb = vi.fn();
      (fake.xread as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const unsubscribe = subscribe("m-1", cb);
      unsubscribe();
      await new Promise((r) => setTimeout(r, 50));

      expect(cb).not.toHaveBeenCalled();
    });

    it("resumes from the provided lastSid instead of the tail", async () => {
      const cb = vi.fn();
      (fake.xread as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const unsubscribe = subscribe("m-1", cb, "1699999999999-5");
      await vi.waitFor(() => expect(fake.xread).toHaveBeenCalled());

      expect(fake.xread).toHaveBeenCalledWith(
        "COUNT",
        100,
        "BLOCK",
        5000,
        "STREAMS",
        "mission:events:m-1",
        "1699999999999-5",
      );
      unsubscribe();
    });
  });

  describe("getLastEvent", () => {
    it("returns the newest stream entry", async () => {
      (fake.xrevrange as ReturnType<typeof vi.fn>).mockResolvedValue([
        ["1699999999999-9", ["p", '{"type":"mission_completed","missionId":"m-1"}']],
      ]);

      const event = await getLastEvent("m-1");
      expect(event).toEqual({
        sid: "1699999999999-9",
        packet: { type: "mission_completed", missionId: "m-1" },
      });
      expect(fake.xrevrange).toHaveBeenCalledWith("mission:events:m-1", "+", "-", "COUNT", 1);
    });

    it("returns null for an empty or missing stream", async () => {
      await expect(getLastEvent("m-1")).resolves.toBeNull();
    });

    it("returns null when redis is unavailable", async () => {
      __setRedisClientForTest(null, false);
      await expect(getLastEvent("m-1")).resolves.toBeNull();
    });
  });

  describe("isTerminalPacket", () => {
    it("marks mission_completed and error as terminal", () => {
      expect(isTerminalPacket({ type: "mission_completed" })).toBe(true);
      expect(isTerminalPacket({ type: "error" })).toBe(true);
    });

    it("does not mark other packets as terminal", () => {
      expect(isTerminalPacket({ type: "content" })).toBe(false);
      expect(isTerminalPacket({ type: "heartbeat" })).toBe(false);
    });
  });
});
