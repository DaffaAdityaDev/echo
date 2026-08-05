import { RestAdapter } from "../adapter";

function jsonResponse(status: number, body: unknown, statusText = "OK") {
  return {
    status,
    ok: status < 400,
    statusText,
    json: async () => body,
    text: async () => "",
  };
}

function makeTool(url = "https://api.example.com/x", method: "GET" | "POST" = "POST") {
  return new RestAdapter().createTool({
    name: "tool",
    description: "d",
    url,
    method,
  });
}

describe("RestAdapter", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("Bun", { sleep: async () => {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test("200 with JSON body returns success observation", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 42 }));
    const tool = makeTool("https://api.example.com/items/1", "GET");
    const obs = await tool.execute({});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/items/1");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    expect(obs).toMatchObject({
      status: "success",
      summary: "GET https://api.example.com/items/1 → 200",
      data: { id: 42 },
    });
  });

  test("retries on 500 and succeeds on second attempt", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, "", "Internal Server Error"))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const tool = makeTool();
    const obs = await tool.execute({ a: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(obs.status).toBe("success");
    expect(obs.summary).toContain("200");
  });

  test("exhausts retries on consecutive 5xx and returns error observation", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, "", "Internal Server Error"));
    const tool = makeTool();
    const obs = await tool.execute({});

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(obs.status).toBe("error");
    expect(obs.summary).toContain("500");
    expect(obs.error).toContain("Internal Server Error");
  });

  test("does not retry on 4xx", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, "", "Bad Request"));
    const tool = makeTool();
    const obs = await tool.execute({});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(obs.status).toBe("error");
    expect(obs.summary).toBe("HTTP 400: Bad Request");
    expect(obs.error).toBe("Bad Request");
  });
});
