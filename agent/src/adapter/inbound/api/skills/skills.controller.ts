import type { Context } from "hono";
import { standardSkills } from "../../../../core/agent/skills";
import type { SkillsResponse } from "./skills.schema";

export function listSkills(c: Context) {
  const skills: SkillsResponse = standardSkills.map((s) => ({
    name: s.name,
    description: s.description,
    preferredTools: s.preferredTools,
    modifiers: s.modifiers,
  }));
  return c.json(skills);
}
