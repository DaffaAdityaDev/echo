import { logger } from "../../../../../shared/utils/logger";
import { HttpStreamTransport } from "../stream.transport";

vi.mock("../../../../../shared/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), langfuse: vi.fn() },
}));

function makeStream() {
  return { writeSSE: vi.fn(async (_packet: { data: string }) => {}) };
}

describe("HttpStreamTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("increments seq across sends and enriches packets", async () => {
    const stream = makeStream();
    const transport = new HttpStreamTransport(stream);

    await transport.send({ type: "content", content: "first" });
    await transport.send({ type: "content", content: "second" });

    expect(stream.writeSSE).toHaveBeenCalledTimes(2);

    const first = JSON.parse(stream.writeSSE.mock.calls[0][0].data);
    expect(first.type).toBe("content");
    expect(first.content).toBe("first");
    expect(first.seq).toBe(1);
    expect(first.timestamp).toEqual(expect.any(Number));

    const second = JSON.parse(stream.writeSSE.mock.calls[1][0].data);
    expect(second.content).toBe("second");
    expect(second.seq).toBe(2);
    expect(second.timestamp).toEqual(expect.any(Number));
  });

  test("swallows writeSSE errors and logs a warning", async () => {
    const stream = {
      writeSSE: vi.fn(async (_packet: { data: string }) => {
        throw new Error("stream closed");
      }),
    };
    const transport = new HttpStreamTransport(stream);

    await expect(transport.send({ type: "content", content: "x" })).resolves.toMatchObject({
      type: "content",
      content: "x",
      seq: 1,
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Failed to write packet to stream"));
  });
});
