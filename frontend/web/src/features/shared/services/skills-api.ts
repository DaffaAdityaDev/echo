import { api } from "@/lib/api-client";
import type { AgentSkill } from "../hooks/useSkills";

export const skillsApi = {
  list: async (): Promise<AgentSkill[]> => {
    return api.get<AgentSkill[]>("/skills");
  },
};
