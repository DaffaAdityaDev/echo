export interface AgentConfig {
  defaultMode: string;
  defaultModel: string;
  defaultFeatures: string[];
  defaultSkills: string[];
  providerType: string;
  apiKey: string;
  hasApiKey: boolean;
  baseUrl: string;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  defaultMode: "standard",
  defaultModel: "",
  defaultFeatures: ["web_search", "write_todos"],
  defaultSkills: [],
  providerType: "opencode-go",
  apiKey: "",
  hasApiKey: false,
  baseUrl: "https://opencode.ai/zen/go/v1",
};
