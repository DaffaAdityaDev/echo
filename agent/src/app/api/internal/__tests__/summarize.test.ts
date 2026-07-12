import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { handleSummarize } from "../summarize";

describe("Agent Summarization Endpoint", () => {
  test("returns 400 when missing messages", async () => {
    const app = new Hono();
    app.post("/summarize", handleSummarize);

    const res = await app.request("/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: "test-session",
        provider_config: {
          type: "openai",
          base_url: "http://localhost",
          model: "gpt-4o"
        }
      })
    });

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toContain("messages");
  });

  test("returns 400 when missing provider_config", async () => {
    const app = new Hono();
    app.post("/summarize", handleSummarize);

    const res = await app.request("/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: "test-session",
        messages: [{ role: "user", content: "hello" }]
      })
    });

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toContain("provider_config");
  });
});
