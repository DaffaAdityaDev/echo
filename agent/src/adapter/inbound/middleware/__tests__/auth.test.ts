import { Hono } from "hono";
import { AUTH_CONSTANTS } from "../../../../shared/constants/middleware";
import { authMiddleware } from "../auth";

vi.mock("../../../../config/env", () => ({
  ENV: { INTERNAL_AUTH_TOKEN: "secret-token" },
}));

vi.mock("../../../../shared/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), langfuse: vi.fn() },
}));

function buildApp() {
  const app = new Hono();
  app.use("*", authMiddleware);
  app.get("/api/v1/test", (c) => c.text("ok"));
  app.get("/docs/anything", (c) => c.text("docs"));
  app.get("/api/docs", (c) => c.text("api-docs"));
  return app;
}

describe("authMiddleware", () => {
  test("bypasses auth for /docs paths without a token", async () => {
    const app = buildApp();
    const res = await app.request("/docs/anything");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("docs");
  });

  test("bypasses auth for /api/docs paths without a token", async () => {
    const app = buildApp();
    const res = await app.request("/api/docs");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("api-docs");
  });

  test("accepts a valid Authorization bearer token", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/test", {
      headers: { Authorization: "Bearer secret-token" },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  test("accepts a valid X-Internal-Token header", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/test", {
      headers: { "X-Internal-Token": "secret-token" },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  test("rejects requests with no token", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/test");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { status: string; message?: string };
    expect(body).toEqual({
      status: "error",
      message: AUTH_CONSTANTS.FORBIDDEN_MESSAGE,
    });
  });

  test("rejects requests with a wrong bearer token", async () => {
    const app = buildApp();
    const res = await app.request("/api/v1/test", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { status: string; message?: string };
    expect(body.status).toBe("error");
  });
});
