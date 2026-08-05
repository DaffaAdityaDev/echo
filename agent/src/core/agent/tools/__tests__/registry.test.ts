import { z } from "zod";
import type { ToolDefinition } from "../../../../shared/types";
import { getImplementedFeatures, LAZY_TOOLS, ToolRegistry } from "../registry";

const mockWebSearchTool: ToolDefinition = {
  name: "web_search",
  description: "Searches the web for real-time information",
  schema: z.object({ query: z.string() }),
  execute: async () => ({ status: "success" as const, summary: "result" }),
  keywords: ["search"],
};

const mockDelegateTaskTool: ToolDefinition = {
  name: "delegate_task",
  description: "Delegates a task to a sub-agent",
  schema: z.object({ task: z.string() }),
  execute: async () => ({ status: "success" as const, summary: "delegated" }),
  keywords: ["delegate"],
};

const mockWriteTodosTool: ToolDefinition = {
  name: "write_todos",
  description: "Updates the task board list state",
  schema: z.object({ todos: z.array(z.object({ id: z.string(), description: z.string() })) }),
  execute: async () => ({ status: "success" as const, summary: "board updated" }),
  keywords: ["todos"],
};

function seedTool(registry: ToolRegistry, tool: ToolDefinition): void {
  (registry as unknown as { tools: Map<string, ToolDefinition> }).tools.set(tool.name, tool);
}

describe("ToolRegistry", () => {
  let registry: ToolRegistry;
  let origWebSearch: (() => Promise<{ default: ToolDefinition } | ToolDefinition>) | undefined;
  let origDelegate: (() => Promise<{ default: ToolDefinition } | ToolDefinition>) | undefined;

  beforeEach(() => {
    registry = new ToolRegistry();
    origWebSearch = LAZY_TOOLS.web_search;
    origDelegate = LAZY_TOOLS.delegate_task;
    LAZY_TOOLS.web_search = () => Promise.resolve({ default: mockWebSearchTool });
    LAZY_TOOLS.delegate_task = () => Promise.resolve({ default: mockDelegateTaskTool });
  });

  afterEach(() => {
    if (origWebSearch) LAZY_TOOLS.web_search = origWebSearch;
    if (origDelegate) LAZY_TOOLS.delegate_task = origDelegate;
  });

  describe("resolveTools", () => {
    test("resolves known feature to tool definition array", async () => {
      const tools = await registry.resolveTools(["web_search"]);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("web_search");
      expect(tools[0].description).toBe("Searches the web for real-time information");
      expect(tools[0].execute).toBeDefined();
      expect(tools[0].schema).toBeDefined();
    });

    test("returns empty array for unknown feature without crashing", async () => {
      const tools = await registry.resolveTools(["unknown_feature"]);
      expect(tools).toEqual([]);
    });

    test("resolves multiple features", async () => {
      const tools = await registry.resolveTools(["web_search", "delegate_task"]);
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name).sort()).toEqual(["delegate_task", "web_search"]);
    });

    test("returns empty array when no features provided", async () => {
      const tools = await registry.resolveTools([]);
      expect(tools).toEqual([]);
    });

    test("returns empty array when features is undefined", async () => {
      const tools = await registry.resolveTools(undefined);
      expect(tools).toEqual([]);
    });
  });

  describe("getTool", () => {
    test("returns tool definition for known tool", () => {
      seedTool(registry, mockWebSearchTool);
      const tool = registry.getTool("web_search") as ToolDefinition;
      expect(tool).toBeDefined();
      expect(tool.name).toBe("web_search");
    });

    test("returns undefined for nonexistent tool", () => {
      const tool = registry.getTool("nonexistent");
      expect(tool).toBeUndefined();
    });
  });

  describe("getAllTools", () => {
    test("returns all registered tools", () => {
      seedTool(registry, mockWebSearchTool);
      seedTool(registry, mockDelegateTaskTool);
      const all = registry.getAllTools();
      expect(all).toHaveLength(2);
    });

    test("returns empty array when no tools registered", () => {
      const all = registry.getAllTools();
      expect(all).toEqual([]);
    });
  });

  describe("getImplementedFeatures", () => {
    test("returns the 3 canonical ids sorted when no tools are loaded", () => {
      const features = getImplementedFeatures(registry);
      expect(features.map((f) => f.id)).toEqual(["delegate_task", "web_search", "write_todos"]);
    });

    test("falls back to the id as name when no tool definition is loaded", () => {
      const features = getImplementedFeatures(registry);
      expect(features).toEqual([
        { id: "delegate_task", name: "delegate_task", description: "" },
        { id: "web_search", name: "web_search", description: "" },
        { id: "write_todos", name: "write_todos", description: "" },
      ]);
    });

    test("uses loaded tool definitions for name and description", () => {
      seedTool(registry, mockWebSearchTool);
      seedTool(registry, mockDelegateTaskTool);
      seedTool(registry, mockWriteTodosTool);
      const features = getImplementedFeatures(registry);
      expect(features).toEqual([
        { id: "delegate_task", name: "delegate_task", description: "Delegates a task to a sub-agent" },
        { id: "web_search", name: "web_search", description: "Searches the web for real-time information" },
        { id: "write_todos", name: "write_todos", description: "Updates the task board list state" },
      ]);
    });

    test("does not include tools outside the LAZY_TOOLS registry", () => {
      seedTool(registry, mockDelegateTaskTool);
      const mcpTool: ToolDefinition = {
        name: "mcp_only_tool",
        description: "Only reachable via MCP",
        schema: z.object({}),
        execute: async () => ({ status: "success" as const, summary: "mcp" }),
      };
      seedTool(registry, mcpTool);
      const features = getImplementedFeatures(registry);
      expect(features.map((f) => f.id)).not.toContain("mcp_only_tool");
    });
  });
});
