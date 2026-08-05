import { Hono } from "hono";
import modelRouter from "../model.routes";

interface ModelsResponse {
  models: Array<{ id: string; name: string }>;
}

vi.mock("../../../../../config/env", () => ({
  ENV: { LLM_MODEL_API_URL: "http://llm.test:1234/" },
  default: { LLM_MODEL_API_URL: "http://llm.test:1234/" },
}));

describe("Models Endpoint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("GET /models returns models mapped from the provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "org/gpt-4o" }, { id: "openai/gpt-4o-mini" }, { id: "no-slash" }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const app = new Hono();
    app.route("/", modelRouter);

    const res = await app.request("/models");
    expect(res.status).toBe(200);
    const body = (await res.json()) as ModelsResponse;
    expect(body.models).toEqual([
      { id: "org/gpt-4o", name: "gpt-4o" },
      { id: "openai/gpt-4o-mini", name: "gpt-4o-mini" },
      { id: "no-slash", name: "no-slash" },
    ]);
    expect(fetchMock).toHaveBeenCalledWith("http://llm.test:1234/v1/models");
  });

  test("GET /models returns an empty list when provider returns no data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 })));

    const app = new Hono();
    app.route("/", modelRouter);

    const res = await app.request("/models");
    expect(res.status).toBe(200);
    const body = (await res.json()) as ModelsResponse;
    expect(body.models).toEqual([]);
  });

  test("GET /models returns an empty list when the provider fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    const app = new Hono();
    app.route("/", modelRouter);

    const res = await app.request("/models");
    expect(res.status).toBe(200);
    const body = (await res.json()) as ModelsResponse;
    expect(body.models).toEqual([]);
  });
});
