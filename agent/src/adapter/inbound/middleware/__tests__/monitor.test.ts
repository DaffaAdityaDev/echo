import { Hono } from "hono";
import { logger } from "../../../../shared/utils/logger";
import { monitorMiddleware } from "../monitor";

vi.mock("../../../../shared/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), langfuse: vi.fn() },
}));

function buildApp() {
  const app = new Hono();
  app.use("*", monitorMiddleware);
  app.get("/ok", (c) => c.text("fine"));
  app.post("/echo", (c) => c.text("done"));
  app.notFound((c) => c.text("not found", 404));
  return app;
}

describe("monitorMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("logs info for successful GET requests", async () => {
    const app = buildApp();
    const res = await app.request("/ok");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("fine");
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("GET /ok"),
      expect.objectContaining({ method: "GET", path: "/ok" }),
    );
  });

  test("strips the history field from logged POST payloads", async () => {
    const app = buildApp();
    const res = await app.request("/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "hello", history: [{ role: "user", content: "old message" }] }),
    });
    expect(res.status).toBe(200);

    const infoCalls = vi.mocked(logger.info).mock.calls;
    const postCall = infoCalls.find(([msg]) => typeof msg === "string" && msg.includes("POST /echo"));
    expect(postCall).toBeDefined();
    const meta = postCall?.[1] as { payload?: { prompt?: string } } | undefined;
    expect(meta?.payload?.prompt).toBe("hello");
    expect(meta?.payload).not.toHaveProperty("history");
  });

  test("logs an error for missing routes returning 404", async () => {
    const app = buildApp();
    const res = await app.request("/missing");
    expect(res.status).toBe(404);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("404"),
      expect.objectContaining({ method: "GET", path: "/missing", status: 404 }),
    );
  });
});
