import { z } from "zod";
import type { AgentState, ToolDefinition } from "../../../../shared/types";
import type { BehaviorPrompt } from "../../prompts";
import { NLAHStrategy } from "../nlah";
import { DEFAULT_NLAH_BEHAVIOR, NLAH_INSTRUCTIONS } from "../prompts";

function makeState(objective: string = "Test objective"): AgentState {
  return {
    missionId: "test-mission",
    objective,
    tasks: [],
    memory: {},
    messages: [],
  };
}

function makeTool(name: string, description: string): ToolDefinition {
  return {
    name,
    description,
    schema: z.object({}),
    execute: async () => ({ status: "success", summary: "ok" }),
  };
}

describe("NLAHStrategy.buildSystemPrompt", () => {
  const strategy = new NLAHStrategy();

  test("returns a string", () => {
    const prompt = strategy.buildSystemPrompt(makeState(), []);
    expect(typeof prompt).toBe("string");
  });

  test("substitutes the objective", () => {
    const prompt = strategy.buildSystemPrompt(makeState("Find the answer"), []);
    expect(prompt).toContain("Find the answer");
  });

  test("renders tools sorted by name with bullets", () => {
    const tools = [makeTool("zebra", "Zebra tool"), makeTool("alpha", "Alpha tool"), makeTool("mike", "Mike tool")];
    const prompt = strategy.buildSystemPrompt(makeState(), tools);

    expect(prompt).toContain("- alpha: Alpha tool");
    expect(prompt).toContain("- mike: Mike tool");
    expect(prompt).toContain("- zebra: Zebra tool");
    expect(prompt.indexOf("- alpha:")).toBeLessThan(prompt.indexOf("- mike:"));
    expect(prompt.indexOf("- mike:")).toBeLessThan(prompt.indexOf("- zebra:"));
  });

  test("in COORDINATOR MODE (with delegate_task), includes research workflow and delegation instructions", () => {
    const tools = [makeTool("delegate_task", "Delegates to sub-agent")];
    const prompt = strategy.buildSystemPrompt(makeState(), tools);

    expect(prompt).toContain("COORDINATOR MODE (active)");
    expect(prompt).toContain(NLAH_INSTRUCTIONS.RESEARCH_WORKFLOW);
    expect(prompt).toContain(NLAH_INSTRUCTIONS.SUBAGENT_DELEGATION);
    expect(prompt).toContain("Orchestrator Only:");
    expect(prompt).toContain(DEFAULT_NLAH_BEHAVIOR);
  });

  test("in DIRECT MODE (without delegate_task), excludes delegation instructions and uses DIRECT MODE header", () => {
    const prompt = strategy.buildSystemPrompt(makeState(), []);

    expect(prompt).toContain("DIRECT MODE (active)");
    expect(prompt).not.toContain("COORDINATOR MODE");
    expect(prompt).not.toContain("SUB-AGENT DELEGATION PROTOCOL");
    expect(prompt).not.toContain("Orchestrator Only:");
  });

  test("when write_todos is present without delegate_task, uses PLANNING WORKFLOW", () => {
    const tools = [makeTool("write_todos", "Manages task list")];
    const prompt = strategy.buildSystemPrompt(makeState(), tools);

    expect(prompt).toContain("DIRECT MODE (active)");
    expect(prompt).toContain("PLANNING WORKFLOW INSTRUCTIONS:");
    expect(prompt).toContain("In-State Planning:");
    expect(prompt).toContain("Durable State:");
    expect(prompt).not.toContain("SUB-AGENT DELEGATION PROTOCOL");
  });

  test("when no research tools are present, uses relaxed completion contract", () => {
    const prompt = strategy.buildSystemPrompt(makeState(), []);

    expect(prompt).toContain("No tool citations are required.");
    expect(prompt).not.toContain("Do not finalize without cited evidence.");
  });

  test("wraps the objective in <user_objective> tags", () => {
    const prompt = strategy.buildSystemPrompt(makeState("Find the answer"), []);
    expect(prompt).toContain("<user_objective>Find the answer</user_objective>");
  });

  test("with a behavior prompt, uses its systemPrompt instead of default workflow", () => {
    const behavior: BehaviorPrompt = {
      templateName: "custom-template",
      version: 3,
      systemPrompt: "CUSTOM WORKFLOW:\n1. Do the custom thing.",
      boundTools: ["write_todos"],
      variables: [],
    };
    const tools = [makeTool("delegate_task", "Delegates to sub-agent")];
    const prompt = strategy.buildSystemPrompt(makeState("Find the answer"), tools, behavior);

    expect(prompt).toContain(behavior.systemPrompt);
    expect(prompt).toContain("<user_objective>Find the answer</user_objective>");
    expect(prompt).not.toContain(DEFAULT_NLAH_BEHAVIOR);
  });

  test("treats a null behavior prompt like an absent one", () => {
    const tools = [makeTool("delegate_task", "Delegates to sub-agent")];
    const prompt = strategy.buildSystemPrompt(makeState(), tools, null);
    expect(prompt).toContain(DEFAULT_NLAH_BEHAVIOR);
  });

  test("always includes base framework sections (CORE PROTOCOLS, USER INPUT BOUNDARY, FORMATTING)", () => {
    const prompt = strategy.buildSystemPrompt(makeState(), []);
    expect(prompt).toContain("CORE PROTOCOLS:");
    expect(prompt).toContain("USER INPUT BOUNDARY:");
    expect(prompt).toContain("FORMATTING:");
    expect(prompt).toContain("AVAILABLE TOOLS:");
    expect(prompt).toContain("OBJECTIVE:");
  });

  test("substitutes placeholders and strips delegation from DB behavior prompt when delegation is inactive", () => {
    const behavior: BehaviorPrompt = {
      templateName: "custom-template",
      version: 1,
      systemPrompt:
        "CUSTOM DB PROMPT:\nObjective: {objective}\nTools: {tools}\nSUB-AGENT DELEGATION PROTOCOL:\n- Delegate everything.",
      boundTools: [],
      variables: [],
    };
    const prompt = strategy.buildSystemPrompt(makeState("Custom objective"), [], behavior);

    expect(prompt).toContain("<user_objective>Custom objective</user_objective>");
    expect(prompt).toContain("(none)");
    expect(prompt).not.toContain("SUB-AGENT DELEGATION PROTOCOL");
  });

  test("safely handles dollar signs ($1, $&, $', $5) in objectives and tool descriptions without JS pattern substitution corruption", () => {
    const tools = [makeTool("price_tool", "Tool for items under $50 & $100")];
    const prompt = strategy.buildSystemPrompt(makeState("Cek harga $5 dan $& serta $' dan $10"), tools);

    expect(prompt).toContain("<user_objective>Cek harga $5 dan $& serta $' dan $10</user_objective>");
    expect(prompt).toContain("Tool for items under $50 & $100");
  });

  test("leaves no template placeholders behind", () => {
    const prompt = strategy.buildSystemPrompt(makeState(), []);
    expect(prompt).not.toContain("{capability_mode}");
    expect(prompt).not.toContain("{core_protocols}");
    expect(prompt).not.toContain("{workflow}");
    expect(prompt).not.toContain("{tools}");
    expect(prompt).not.toContain("{objective}");
    expect(prompt).not.toContain("{completion}");
  });
});
