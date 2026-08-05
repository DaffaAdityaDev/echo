import { writeTodosTool } from "../planning";

vi.mock("../../../../../shared/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    agentActivity: vi.fn(),
    langfuse: vi.fn(),
    telemetry: vi.fn(),
  },
}));

describe("writeTodosTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("exposes the expected name, description and keywords", () => {
    expect(writeTodosTool.name).toBe("write_todos");
    expect(writeTodosTool.description.length).toBeGreaterThan(0);
    expect(writeTodosTool.keywords).toContain("todo");
  });

  describe("schema", () => {
    test("accepts a valid todo list", () => {
      const parsed = writeTodosTool.schema.safeParse({
        todos: [{ id: "t1", description: "Research", status: "pending" }],
      });
      expect(parsed.success).toBe(true);
    });

    test("rejects an invalid todo status", () => {
      const parsed = writeTodosTool.schema.safeParse({
        todos: [{ id: "t1", description: "Research", status: "bogus" }],
      });
      expect(parsed.success).toBe(false);
    });

    test("rejects a todo missing its description", () => {
      const parsed = writeTodosTool.schema.safeParse({ todos: [{ id: "t1", status: "pending" }] });
      expect(parsed.success).toBe(false);
    });
  });

  describe("execute", () => {
    test("adds a todo to the plan", async () => {
      const observation = await writeTodosTool.execute({
        todos: [{ id: "t1", description: "Research the market", status: "pending" }],
      });

      expect(observation.status).toBe("success");
      expect(observation.summary).toBe("Successfully updated plan with 1 tasks.");
      expect(
        (observation.data as { todos: Array<{ id: string; description: string; status: string }> }).todos[0],
      ).toEqual({
        id: "t1",
        description: "Research the market",
        status: "pending",
      });
    });

    test("updates a todo status across the list", async () => {
      const observation = await writeTodosTool.execute({
        todos: [
          { id: "t1", description: "Research", status: "done" },
          { id: "t2", description: "Draft", status: "in_progress" },
        ],
      });

      expect(observation.status).toBe("success");
      expect(observation.summary).toBe("Successfully updated plan with 2 tasks.");
      const todos = (observation.data as { todos: Array<{ id: string; description: string; status: string }> }).todos;
      expect(todos[0].status).toBe("done");
      expect(todos[1].status).toBe("in_progress");
    });

    test("lists all todos in the observation data", async () => {
      const todos = [
        { id: "t1", description: "Plan", status: "pending" },
        { id: "t2", description: "Execute", status: "in_progress" },
        { id: "t3", description: "Review", status: "failed" },
      ];

      const observation = await writeTodosTool.execute({ todos });

      expect((observation.data as { todos: Array<{ id: string; description: string; status: string }> }).todos).toEqual(
        todos,
      );
      expect(observation.summary).toBe("Successfully updated plan with 3 tasks.");
    });

    test("returns an error observation when execution throws", async () => {
      const observation = await writeTodosTool.execute({} as unknown as Parameters<typeof writeTodosTool.execute>[0]);

      expect(observation.status).toBe("error");
      expect(observation.error).toBeDefined();
      expect(observation.summary).toContain("Failed to write plan");
    });
  });
});
