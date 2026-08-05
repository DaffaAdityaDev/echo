import { webSearchTool } from "../web-search";

const HTML_BODY = `
<html>
  <body>
    <div class="results">
      <div class="result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Farticle&rut=abc123">Example Article Title</a>
        <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Farticle">This is the snippet <b>text</b> for the first result.</a>
      </div>
      <div class="result">
        <a class="result__a" href="https://direct.example.org/page">Direct Link Title</a>
        <a class="result__snippet" href="https://direct.example.org/page">Second result snippet without a redirect.</a>
      </div>
    </div>
  </body>
</html>
`;

describe("webSearchTool", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test("exposes the expected name, description and keywords", () => {
    expect(webSearchTool.name).toBe("web_search");
    expect(webSearchTool.description.length).toBeGreaterThan(0);
    expect(webSearchTool.keywords).toContain("search");
  });

  describe("schema", () => {
    test("accepts a valid query", () => {
      const parsed = webSearchTool.schema.safeParse({ query: "weather in Berlin" });
      expect(parsed.success).toBe(true);
    });

    test("rejects a missing query", () => {
      const parsed = webSearchTool.schema.safeParse({});
      expect(parsed.success).toBe(false);
    });
  });

  describe("execute", () => {
    test("returns a success observation with the extracted text", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(HTML_BODY, { status: 200 })));

      const observation = await webSearchTool.execute({ query: "market size" });

      expect(observation.status).toBe("success");
      expect(observation.summary).toContain("Example Article Title");
      expect(observation.summary).toContain("This is the snippet text for the first result.");
      expect(observation.summary).toContain("https://example.com/article");
      const results = (observation.data as { results: Array<{ title: string; snippet: string; url: string }> }).results;
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Example Article Title");
      expect(results[0].snippet).toBe("This is the snippet text for the first result.");
    });

    test("decodes duckduckgo redirect urls", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(HTML_BODY, { status: 200 })));

      const observation = await webSearchTool.execute({ query: "market size" });

      const results = (observation.data as { results: Array<{ title: string; snippet: string; url: string }> }).results;
      expect(results[0].url).toBe("https://example.com/article");
      expect(results[1].url).toBe("https://direct.example.org/page");
    });

    test("returns a warning observation when no results are found", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html><body></body></html>", { status: 200 })));

      const observation = await webSearchTool.execute({ query: "nothing" });

      expect(observation.status).toBe("warning");
      expect(observation.summary).toContain("No results found");
    });

    test("returns an error observation when fetch rejects", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

      const observation = await webSearchTool.execute({ query: "market size" });

      expect(observation.status).toBe("error");
      expect(observation.error).toBe("network down");
      expect(observation.summary).toContain("Failed to search for");
    });

    test("returns an error observation on a non-ok http response", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));

      const observation = await webSearchTool.execute({ query: "market size" });

      expect(observation.status).toBe("error");
      expect(observation.summary).toContain("DuckDuckGo returned status 500");
    });
  });
});
