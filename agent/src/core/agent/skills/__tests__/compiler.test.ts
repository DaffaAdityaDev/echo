import { SkillCompiler } from "../compiler";
import type { SkillDefinition } from "../types";

describe("SkillCompiler", () => {
  const compiler = new SkillCompiler();

  test("fills all variables when all values provided", () => {
    const skill: SkillDefinition = {
      name: "coding",
      description: "Code generation",
      systemPrompt: "Use {language} and follow {style} guidelines",
      variables: ["language", "style"],
    };
    const result = compiler.compile(skill, { language: "TypeScript", style: "Clean Code" });
    expect(result).toBe("Use TypeScript and follow Clean Code guidelines");
    expect(result).not.toContain("{language}");
    expect(result).not.toContain("{style}");
  });

  test("keeps the placeholder text in output when a variable value is missing", () => {
    const skill: SkillDefinition = {
      name: "coding",
      description: "Code generation",
      systemPrompt: "Use {language} and follow {style} guidelines",
      variables: ["language", "style"],
    };
    const result = compiler.compile(skill, { language: "TypeScript" });
    expect(result).toContain("Use TypeScript");
    expect(result).toContain("{style}");
  });

  test("returns prompt as-is when skill has no variables", () => {
    const skill: SkillDefinition = {
      name: "simple",
      description: "Simple skill",
      systemPrompt: "You are a helpful assistant",
    };
    const result = compiler.compile(skill);
    expect(result).toBe("You are a helpful assistant");
  });

  test("returns prompt as-is when no variables provided", () => {
    const skill: SkillDefinition = {
      name: "coding",
      description: "Code generation",
      systemPrompt: "Use {language}",
      variables: ["language"],
    };
    const result = compiler.compile(skill, undefined);
    expect(result).toBe("Use {language}");
  });

  test("returns empty string when skill has no systemPrompt", () => {
    const skill: SkillDefinition = {
      name: "empty",
      description: "No prompt",
    };
    const result = compiler.compile(skill, { x: "y" });
    expect(result).toBe("");
  });

  test("replaces same variable appearing multiple times", () => {
    const skill: SkillDefinition = {
      name: "repeat",
      description: "Repeated variable",
      systemPrompt: "{name}, your task is {name}",
      variables: ["name"],
    };
    const result = compiler.compile(skill, { name: "Agent" });
    expect(result).toBe("Agent, your task is Agent");
  });
});
