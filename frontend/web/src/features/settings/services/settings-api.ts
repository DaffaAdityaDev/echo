import { api } from "@/lib/api-client";
import type { AgentConfig, HarnessFeatureToggles } from "../types";
import { DEFAULT_AGENT_CONFIG } from "../types";

interface UserPreferencesDTO {
  user_id: number;
  default_mode?: string;
  default_model?: string;
  default_features?: string[];
  default_skills?: string[];
  provider_type?: string;
  has_api_key?: boolean;
  base_url?: string;
  harness_toggles?: HarnessFeatureToggles;
}

function toAgentConfig(dto: UserPreferencesDTO): AgentConfig {
  return {
    defaultMode: dto.default_mode ?? DEFAULT_AGENT_CONFIG.defaultMode,
    defaultModel: dto.default_model ?? DEFAULT_AGENT_CONFIG.defaultModel,
    defaultFeatures: dto.default_features ?? DEFAULT_AGENT_CONFIG.defaultFeatures,
    defaultSkills: dto.default_skills ?? DEFAULT_AGENT_CONFIG.defaultSkills,
    providerType: dto.provider_type ?? DEFAULT_AGENT_CONFIG.providerType,
    apiKey: "", // Never pre-fill — user must enter key to change
    hasApiKey: dto.has_api_key ?? false,
    baseUrl: dto.base_url ?? DEFAULT_AGENT_CONFIG.baseUrl,
    harnessToggles: dto.harness_toggles ?? undefined,
  };
}

function toDTO(config: AgentConfig): Record<string, unknown> {
  const body: Record<string, unknown> = {
    default_mode: config.defaultMode,
    default_model: config.defaultModel,
    default_features: config.defaultFeatures,
    default_skills: config.defaultSkills,
    provider_type: config.providerType,
    base_url: config.baseUrl,
  };

  if (config.apiKey) {
    body.api_key = config.apiKey;
    body.keep_api_key = false;
  } else if (config.hasApiKey) {
    body.keep_api_key = true;
  }

  if (config.harnessToggles) {
    body.harness_toggles = config.harnessToggles;
  }

  return body;
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
