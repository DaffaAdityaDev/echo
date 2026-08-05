import { Hono } from "hono";
import docsRouter from "../docs";

describe("Docs Endpoint", () => {
  test("GET /docs serves the HTML API reference", async () => {
    const app = new Hono();
    app.route("/docs", docsRouter);

    const res = await app.request("/docs");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const body = await res.text();
    expect(body.length).toBeGreaterThan(0);
  });
});
