import { api } from "@/lib/api-client";
import type { AgentConfig } from "../types";

interface UserPreferencesDTO {
  user_id: number;
  default_mode: string;
  default_model: string;
  default_features: string[];
  default_skills: string[];
}

function toAgentConfig(dto: UserPreferencesDTO): AgentConfig {
  return {
    defaultMode: dto.default_mode,
    defaultModel: dto.default_model,
    defaultFeatures: dto.default_features,
    defaultSkills: dto.default_skills,
  };
}

function toDTO(config: AgentConfig): Record<string, unknown> {
  return {
    default_mode: config.defaultMode,
    default_model: config.defaultModel,
    default_features: config.defaultFeatures,
    default_skills: config.defaultSkills,
  };
}

export const settingsApi = {
  get: async (): Promise<AgentConfig> => {
    const data = await api.get<UserPreferencesDTO>("/settings");
    return toAgentConfig(data);
  },

  update: async (config: AgentConfig): Promise<AgentConfig> => {
    const data = await api.put<UserPreferencesDTO>("/settings", toDTO(config));
    return toAgentConfig(data);
  },

};
