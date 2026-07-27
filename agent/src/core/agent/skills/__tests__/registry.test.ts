
import { SkillRegistry } from "../registry";
import type { SkillDefinition } from "../types";

describe("SkillRegistry", () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    (SkillRegistry as any).instance = undefined;
    registry = SkillRegistry.getInstance();
  });

  describe("getSkill", () => {
    test("returns skill definition for known skill", () => {
      const skill = registry.getSkill("coding");
      expect(skill).toBeDefined();
      expect(skill!.name).toBe("coding");
      expect(skill!.description).toBeDefined();
      expect(skill!.systemPrompt).toBeDefined();
    });

    test("returns undefined for nonexistent skill", () => {
      const skill = registry.getSkill("nonexistent");
      expect(skill).toBeUndefined();
    });

    test("retrieves all standard skills", () => {
      const names = ["reasoning", "coding", "research", "planning", "analyst"];
      for (const name of names) {
        expect(registry.getSkill(name)).toBeDefined();
      }
    });
  });

  describe("getAllSkills", () => {
    test("returns array of all available skills", () => {
      const all = registry.getAllSkills();
      expect(all).toBeDefined();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThanOrEqual(5);
      expect(all.map((s) => s.name)).toContain("coding");
      expect(all.map((s) => s.name)).toContain("planning");
    });
  });

  describe("registerSkill", () => {
    test("adds new skill to registry", () => {
      const custom: SkillDefinition = {
        name: "custom-test",
        description: "Custom test skill",
        systemPrompt: "You are testing",
      };
      registry.registerSkill(custom);
      expect(registry.getSkill("custom-test")).toBeDefined();
    });

    test("overwrites existing skill with same name", () => {
      registry.registerSkill({
        name: "coding",
        description: "Overridden",
        systemPrompt: "Overridden prompt",
      });
      const skill = registry.getSkill("coding");
      expect(skill!.description).toBe("Overridden");
    });
  });

  describe("registerCustomSkill", () => {
    test("registers skill with custom: prefix", () => {
      registry.registerCustomSkill({
        name: "my-skill",
        description: "My custom skill",
        systemPrompt: "Custom prompt",
      });
      expect(registry.getSkill("custom:my-skill")).toBeDefined();
      expect(registry.getSkill("my-skill")).toBeUndefined();
    });
  });

  describe("compileSkillPrompts", () => {
    test("compiles prompts for active skills", () => {
      const result = registry.compileSkillPrompts(["coding", "reasoning"]);
      expect(result).toContain("[coding mode]");
      expect(result).toContain("[reasoning mode]");
      expect(result).toContain("type annotations");
      expect(result).toContain("step-by-step");
    });

    test("returns empty string for unknown skills", () => {
      const result = registry.compileSkillPrompts(["nonexistent"]);
      expect(result).toBe("");
    });

    test("passes variables to compiler", () => {
      const custom: SkillDefinition = {
        name: "template",
        description: "Template skill",
        systemPrompt: "Hello {name}",
        variables: ["name"],
      };
      registry.registerSkill(custom);
      const result = registry.compileSkillPrompts(["template"], { name: "World" });
      expect(result).toContain("Hello World");
    });
  });

  describe("compileModifiers", () => {
    test("merges modifiers from multiple skills", () => {
      const result = registry.compileModifiers(["coding", "research"]);
      expect(result.temperature).toBeDefined();
      expect(result.maxTokens).toBeDefined();
    });

    test("returns empty object when skills have no modifiers", () => {
      const custom: SkillDefinition = {
        name: "bare",
        description: "Bare skill",
      };
      registry.registerSkill(custom);
      const result = registry.compileModifiers(["bare"]);
      expect(result).toEqual({});
    });
  });

  describe("getToolFilter", () => {
    test("returns null when no skills have allowedTools", () => {
      const result = registry.getToolFilter(["coding"]);
      expect(result).toBeNull();
    });

    test("returns intersection of allowedTools across multiple skills", () => {
      registry.registerSkill({
        name: "skill-a",
        description: "A",
        allowedTools: ["web_search", "delegate_task"],
      });
      registry.registerSkill({
        name: "skill-b",
        description: "B",
        allowedTools: ["web_search", "write_todos"],
      });
      const result = registry.getToolFilter(["skill-a", "skill-b"]);
      expect(result).toEqual(["web_search"]);
    });

    test("returns empty array when intersection is empty", () => {
      registry.registerSkill({
        name: "skill-x",
        description: "X",
        allowedTools: ["tool_a"],
      });
      registry.registerSkill({
        name: "skill-y",
        description: "Y",
        allowedTools: ["tool_b"],
      });
      const result = registry.getToolFilter(["skill-x", "skill-y"]);
      expect(result).toEqual([]);
    });
  });

  describe("singleton", () => {
    test("getInstance returns the same instance", () => {
      const instance1 = SkillRegistry.getInstance();
      const instance2 = SkillRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
