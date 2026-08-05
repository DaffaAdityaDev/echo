import { z } from "zod";
import type { AgentState, ToolDefinition } from "../../../../shared/types";
import { NLAHStrategy } from "../nlah";
import { NLAH_INSTRUCTIONS } from "../prompts";

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

  test("includes research workflow and delegation instructions", () => {
    const prompt = strategy.buildSystemPrompt(makeState(), []);
    expect(prompt).toContain(NLAH_INSTRUCTIONS.RESEARCH_WORKFLOW);
    expect(prompt).toContain(NLAH_INSTRUCTIONS.SUBAGENT_DELEGATION);
    expect(prompt).toContain("RESEARCH WORKFLOW INSTRUCTIONS");
    expect(prompt).toContain("SUB-AGENT DELEGATION PROTOCOL");
  });

  test("leaves no template placeholders behind", () => {
    const prompt = strategy.buildSystemPrompt(makeState(), []);
    expect(prompt).not.toContain("{objective}");
    expect(prompt).not.toContain("{tools}");
    expect(prompt).not.toContain("{workflow}");
    expect(prompt).not.toContain("{delegation}");
  });
});
