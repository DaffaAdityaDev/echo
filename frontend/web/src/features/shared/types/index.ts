export interface AgentFeature {
  id: string;
  name: string;
  description: string;
  locked: boolean;
}

export interface AgentSkill {
  name: string;
  description: string;
  preferredTools: string[];
  modifiers: Record<string, unknown>;
}
