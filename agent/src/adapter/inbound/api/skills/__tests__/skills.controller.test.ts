import { Hono } from "hono";
import { standardSkills } from "../../../../../core/agent/skills";
import skillsRouter from "../skills.routes";

interface SkillItem {
  name: string;
  description: string;
  preferredTools: string[];
  modifiers: { temperature: number; maxTokens: number };
}

describe("Skills Endpoint", () => {
  test("GET /skills returns all standard skills", async () => {
    const app = new Hono();
    app.route("/", skillsRouter);

    const res = await app.request("/skills");
    expect(res.status).toBe(200);
    const body = (await res.json()) as SkillItem[];
    expect(body).toHaveLength(standardSkills.length);
    const names = body.map((skill) => skill.name);
    for (const skill of standardSkills) {
      expect(names).toContain(skill.name);
    }
  });

  test("GET /skills returns skills with the expected shape", async () => {
    const app = new Hono();
    app.route("/", skillsRouter);

    const res = await app.request("/skills");
    const body = (await res.json()) as SkillItem[];
    for (const skill of body) {
      expect(typeof skill.name).toBe("string");
      expect(typeof skill.description).toBe("string");
      expect(Array.isArray(skill.preferredTools)).toBe(true);
      expect(typeof skill.modifiers).toBe("object");
    }
  });

  test("the coding skill is included with its modifiers", async () => {
    const app = new Hono();
    app.route("/", skillsRouter);

    const res = await app.request("/skills");
    const body = (await res.json()) as SkillItem[];
    const coding = body.find((skill) => skill.name === "coding") as SkillItem;
    expect(coding).toBeDefined();
    expect(coding.preferredTools).toEqual(["web_search"]);
    expect(coding.modifiers.temperature).toBe(0.2);
    expect(coding.modifiers.maxTokens).toBe(8192);
  });
});
