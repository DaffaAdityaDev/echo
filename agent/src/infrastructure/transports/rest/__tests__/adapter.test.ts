import type { JsonValue } from "../../../../shared/types";
import { RestAdapter } from "../adapter";

function jsonResponse(status: number, body: JsonValue, statusText = "OK") {
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

  test("retries idempotent GET on 500 and succeeds on second attempt", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, "", "Internal Server Error"))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const tool = makeTool("https://api.example.com/x", "GET");
    const obs = await tool.execute({ a: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(obs.status).toBe("success");
    expect(obs.summary).toContain("200");
  });

  test("exhausts retries on consecutive 5xx and returns error observation", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, "", "Internal Server Error"));
    const tool = makeTool("https://api.example.com/x", "GET");
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

  test("does not retry non-idempotent POST on 5xx", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, "", "Internal Server Error"));
    const obs = await makeTool().execute({});

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(obs.status).toBe("error");
  });

  test("retries idempotent GET on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET")).mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const obs = await makeTool("https://api.example.com/x", "GET").execute({});

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(obs.status).toBe("success");
  });

  test("does not resolve $env references in model arguments", async () => {
    vi.stubEnv("SERVICE_JWT_SECRET", "top-secret");
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await makeTool().execute({ leak: "$env.SERVICE_JWT_SECRET" });

    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ leak: "$env.SERVICE_JWT_SECRET" }));
    vi.unstubAllEnvs();
  });

  test("preserves nested objects in the request body", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const input = { filter: { name: "a", tags: ["x"] } };
    await makeTool().execute(input);

    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify(input));
  });

  test("encodes interpolated url path segments", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    const tool = new RestAdapter().createTool({
      name: "tool",
      description: "d",
      url: "https://api.example.com/items/{id}",
      method: "POST",
      url_interpolation: true,
    });
    await tool.execute({ id: "../admin?x=1" });

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/items/..%2Fadmin%3Fx%3D1");
  });
});
