export type VersionStatus = 'draft' | 'in_review' | 'shadow' | 'approved' | 'production' | 'rolled_back'

export interface PromptTemplate {
  id: string
  tenant_id: string
  name: string
  description: string
  active_version: number
  created_at: string
  updated_at: string
}

export interface PromptVersion {
  id: string
  template_id: string
  version: number
  system_prompt: string
  bound_tools: string[]
  variables: string[]
  status: VersionStatus
  created_by: string
  created_at: string
}

export interface TestCase {
  input: string
  expected_output: string
}

export interface EvalDataset {
  id: string
  tenant_id: string
  name: string
  description: string
  test_cases: TestCase[]
  created_by: string
  created_at: string
}

export interface EvalRun {
  id: string
  prompt_version_id: string
  dataset_id: string | null
  pass_rate: number
  score_accuracy: number
  score_format: number
  score_tools: number
  details: EvalRunDetail[]
  executed_by: string
  created_at: string
}

export interface EvalRunDetail {
  input: string
  expected_output: string
  ai_output: string
  passed: boolean
  score_accuracy: number
  score_format: number
  score_tools: number
  reasoning: string
}

export interface ShadowRun {
  id: string
  template_id: string
  live_version_id: string
  candidate_version_id: string
  user_query: string
  live_output: string
  shadow_output: string
  live_cost_usd: number
  shadow_cost_usd: number
  live_latency_ms: number
  shadow_latency_ms: number
  created_at: string
}

export interface AuditLog {
  id: string
  tenant_id: string
  actor: string
  action: string
  resource: string
  payload: Record<string, unknown>
  created_at: string
}

export interface PlaygroundResult {
  model: string
  content: string
  latency_ms: number
  tokens: number
  error?: string
}

// AI-Ready Maturity Model Types
export type MaturityLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5'

export type MaturityDimensionKey =
  | 'tools'
  | 'skills'
  | 'prompts'
  | 'security'
  | 'data'
  | 'observability'
  | 'documentation'

export interface MaturityLevelInfo {
  level: MaturityLevel
  name: string
  definition: string
  description: string
  color: string
}

export interface MaturityDimensionLevelMapping {
  level: MaturityLevel
  description: string
  nextPatternSlot?: string
}

export interface MaturityDimension {
  key: MaturityDimensionKey
  name: string
  description: string
  currentLevel: MaturityLevel
  evidence: string
  l3Pattern: string
  l4Pattern: string
  nextSlot?: string
  levels: Record<MaturityLevel, string>
}

export interface SystemMaturityAssessment {
  overallLevel: MaturityLevel
  weakestDimension: MaturityDimensionKey
  dimensions: Record<MaturityDimensionKey, MaturityDimension>
  lastAssessedAt: string
}

export interface RoadmapItem {
  id: string
  order: number
  dimension: MaturityDimensionKey
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  status: 'completed' | 'in_progress' | 'planned'
  targetLevel: MaturityLevel
}

export interface ScoringQuestion {
  id: string
  dimension: MaturityDimensionKey
  question: string
  minLevel: MaturityLevel
}

export interface ClientAssessmentScore {
  dimension: MaturityDimensionKey
  level: MaturityLevel
  evidence: string
  quickestL3Action?: string
}

export interface ClientCompanyAssessment {
  clientName: string
  assessedAt: string
  overallLevel: MaturityLevel
  weakestDimension: MaturityDimensionKey
  scores: Record<MaturityDimensionKey, ClientAssessmentScore>
  notes?: string
}

