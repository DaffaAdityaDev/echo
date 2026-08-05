import { standardSkills } from "../library";

describe("standardSkills", () => {
  test("contains exactly 5 skills with the expected names", () => {
    expect(standardSkills).toHaveLength(5);
    expect(standardSkills.map((skill) => skill.name)).toEqual([
      "reasoning",
      "coding",
      "research",
      "planning",
      "analyst",
    ]);
  });

  test("every skill has name, description, systemPrompt, preferredTools and modifiers", () => {
    for (const skill of standardSkills) {
      expect(typeof skill.name).toBe("string");
      expect(typeof skill.description).toBe("string");
      expect(typeof skill.systemPrompt).toBe("string");
      expect(Array.isArray(skill.preferredTools)).toBe(true);
      expect(skill.modifiers).toBeDefined();
    }
  });

  test("coding and research prefer web_search", () => {
    const coding = standardSkills.find((skill) => skill.name === "coding");
    const research = standardSkills.find((skill) => skill.name === "research");

    expect(coding?.preferredTools).toContain("web_search");
    expect(research?.preferredTools).toContain("web_search");
  });

  test("planning prefers write_todos and delegate_task", () => {
    const planning = standardSkills.find((skill) => skill.name === "planning");

    expect(planning?.preferredTools).toContain("write_todos");
    expect(planning?.preferredTools).toContain("delegate_task");
  });

  test("modifiers have numeric temperature and maxTokens", () => {
    for (const skill of standardSkills) {
      expect(typeof skill.modifiers?.temperature).toBe("number");
      expect(typeof skill.modifiers?.maxTokens).toBe("number");
    }
  });
});
