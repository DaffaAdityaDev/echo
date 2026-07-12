export interface AgentConfig {
  defaultMode: string;
  defaultModel: string;
  defaultFeatures: string[];
  defaultSkills: string[];
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  defaultMode: "standard",
  defaultModel: "",
  defaultFeatures: ["web_search", "write_todos"],
  defaultSkills: [],
};
