export type VersionStatus = "draft" | "in_review" | "approved" | "production" | "rolled_back";

export interface PromptTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  active_version: number;
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: string;
  template_id: string;
  version: number;
  system_prompt: string;
  bound_tools: string[];
  variables: string[];
  status: VersionStatus;
  created_by: string;
  created_at: string;
}

// AI-Ready Maturity Model Types
export type MaturityLevel = "L1" | "L2" | "L3" | "L4" | "L5";

export type MaturityDimensionKey =
  | "tools"
  | "skills"
  | "prompts"
  | "security"
  | "data"
  | "observability"
  | "documentation";

export interface MaturityLevelInfo {
  level: MaturityLevel;
  name: string;
  definition: string;
  description: string;
  color: string;
}

export interface MaturityDimensionLevelMapping {
  level: MaturityLevel;
  description: string;
  nextPatternSlot?: string;
}

export interface MaturityDimension {
  key: MaturityDimensionKey;
  name: string;
  description: string;
  currentLevel: MaturityLevel;
  evidence: string;
  l3Pattern: string;
  l4Pattern: string;
  nextSlot?: string;
  levels: Record<MaturityLevel, string>;
}

export interface SystemMaturityAssessment {
  overallLevel: MaturityLevel;
  weakestDimension: MaturityDimensionKey;
  dimensions: Record<MaturityDimensionKey, MaturityDimension>;
  lastAssessedAt: string;
}

export interface RoadmapItem {
  id: string;
  order: number;
  dimension: MaturityDimensionKey;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "completed" | "in_progress" | "planned";
  targetLevel: MaturityLevel;
}

export interface ScoringQuestion {
  id: string;
  dimension: MaturityDimensionKey;
  question: string;
  minLevel: MaturityLevel;
}

export interface ClientAssessmentScore {
  dimension: MaturityDimensionKey;
  level: MaturityLevel;
  evidence: string;
  quickestL3Action?: string;
}

export interface ClientCompanyAssessment {
  clientName: string;
  assessedAt: string;
  overallLevel: MaturityLevel;
  weakestDimension: MaturityDimensionKey;
  scores: Record<MaturityDimensionKey, ClientAssessmentScore>;
  notes?: string;
}
