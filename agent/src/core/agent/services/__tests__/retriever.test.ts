import { z } from "zod";
import type { ToolDefinition } from "../../../../shared/types";
import { ToolRetriever } from "../retriever";

function makeTool(overrides: Partial<ToolDefinition> & { name: string }): ToolDefinition {
  return {
    description: "",
    schema: z.object({}),
    execute: async () => ({ status: "success" as const, summary: "ok" }),
    ...overrides,
  };
}

describe("ToolRetriever", () => {
  const webSearchTool = makeTool({
    name: "web_search",
    description: "Search the web for real-time information",
    keywords: ["search", "web", "internet", "browser"],
  });

  const delegateTaskTool = makeTool({
    name: "delegate_task",
    description: "Delegate a task to a sub-agent",
    keywords: ["delegate", "sub-agent", "subtask"],
  });

  const writeTodosTool = makeTool({
    name: "write_todos",
    description: "Create and manage task todos",
    keywords: ["todo", "task", "plan", "track"],
  });

  const allTools = [webSearchTool, delegateTaskTool, writeTodosTool];

  describe("getRelevantTools", () => {
    test("returns tools matching query keywords", () => {
      const retriever = new ToolRetriever();
      const result = retriever.getRelevantTools("search the web", allTools);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("web_search");
    });

    test("returns tools matching query via description", () => {
      const retriever = new ToolRetriever();
      const result = retriever.getRelevantTools("Create and manage", allTools);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("write_todos");
    });

    test("returns tools matching query via name", () => {
      const retriever = new ToolRetriever();
      const result = retriever.getRelevantTools("write_todos", allTools);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("write_todos");
    });

    test("returns empty array when no tools match (no implicit fallback)", () => {
      const retriever = new ToolRetriever();
      const result = retriever.getRelevantTools("xyznonexistent12345", allTools);
      expect(result).toEqual([]);
    });

    test("returns multiple tools ranked by score", () => {
      const retriever = new ToolRetriever();
      const result = retriever.getRelevantTools("search delegate task", allTools);
      expect(result.length).toBeGreaterThanOrEqual(1);
      const names = result.map((t) => t.name);
      expect(names).toContain("web_search");
    });

    test("respects custom limit", () => {
      const retriever = new ToolRetriever();
      const result = retriever.getRelevantTools("search task todo plan delegate sub-agent", allTools, 2);
      expect(result.length).toBeLessThanOrEqual(2);
    });

    test("returns all tools when query is empty (description match on all)", () => {
      const retriever = new ToolRetriever();
      const result = retriever.getRelevantTools("", allTools);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result).toBeDefined();
    });

    test("handles tools with no keywords gracefully", () => {
      const bareTool = makeTool({ name: "bareBare", description: "A bare tool" });
      const retriever = new ToolRetriever();
      const result = retriever.getRelevantTools("xyznonexistent", [bareTool, webSearchTool]);
      expect(result).toEqual([]);
    });

    test("returns empty array when allTools is empty", () => {
      const retriever = new ToolRetriever();
      const result = retriever.getRelevantTools("anything", []);
      expect(result).toEqual([]);
    });
  });
});
