export type LoopDetectionConfig = {
  enabled: boolean;
  enableExactMatch?: boolean;
  enableCosineSimilarity?: boolean;
  maxConsecutiveIdenticalCalls?: number;
  similarityThreshold?: number;
  windowSize?: number;
};

export type BudgetMonitorConfig = {
  enabled: boolean;
  enforceMaxSteps?: boolean;
  maxSteps?: number;
  enforceTimeout?: boolean;
  maxDurationMs?: number;
  enforceCostCap?: boolean;
  maxCostUsd?: number;
};

export type SystemNoticesConfig = {
  enabled: boolean;
  emitLoopWarnings?: boolean;
  emitCompactionNotices?: boolean;
  emitBudgetWarnings?: boolean;
  emitPacingWarnings?: boolean;
};

export type HitlGuardConfig = {
  enabled: boolean;
  protectedTools?: string[];
  ttlMinutes?: number;
};

export type ContextOptimizationConfig = {
  enabled: boolean;
  enablePrefixCachingLayout?: boolean;
  enableAutoCompaction?: boolean;
  compactionThresholdRatio?: number;
  keepLastTurnsCount?: number;
};

export type HarnessFeatureToggles = {
  loopDetection?: LoopDetectionConfig;
  budgetMonitor?: BudgetMonitorConfig;
  systemNotices?: SystemNoticesConfig;
  hitlGuard?: HitlGuardConfig;
  contextOptimization?: ContextOptimizationConfig;
};

export interface AgentConfig {
  defaultMode: string;
  defaultModel: string;
  defaultFeatures: string[];
  defaultSkills: string[];
  providerType: string;
  apiKey: string;
  hasApiKey: boolean;
  baseUrl: string;
  harnessToggles?: HarnessFeatureToggles;
}

export type AgentConfigDTO = {
  default_mode?: string;
  default_model?: string;
  default_features?: string[];
  default_skills?: string[];
  provider_type?: string;
  api_key?: string;
  has_api_key?: boolean;
  keep_api_key?: boolean;
  base_url?: string;
  harness_toggles?: HarnessFeatureToggles;
};

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  defaultMode: "standard",
  defaultModel: "",
  defaultFeatures: ["write_todos"],
  defaultSkills: [],
  providerType: "opencode-go",
  apiKey: "",
  hasApiKey: false,
  baseUrl: process.env.NEXT_PUBLIC_AGENT_BASE_URL || "https://opencode.ai/zen/go/v1",
};

export const DEFAULT_HARNESS_TOGGLES: HarnessFeatureToggles = {
  loopDetection: {
    enabled: true,
    enableExactMatch: true,
    enableCosineSimilarity: true,
    maxConsecutiveIdenticalCalls: 3,
    similarityThreshold: 0.92,
    windowSize: 10,
  },
  budgetMonitor: {
    enabled: true,
    enforceMaxSteps: true,
    maxSteps: 15,
    enforceTimeout: true,
    maxDurationMs: 120_000,
    enforceCostCap: true,
    maxCostUsd: 1.0,
  },
  systemNotices: {
    enabled: true,
    emitLoopWarnings: true,
    emitCompactionNotices: true,
    emitBudgetWarnings: true,
    emitPacingWarnings: true,
  },
  hitlGuard: {
    enabled: true,
    protectedTools: ["execute_sql_write", "delete_file", "send_external_email", "deploy_infrastructure", "write_file"],
    ttlMinutes: 5,
  },
  contextOptimization: {
    enabled: true,
    enablePrefixCachingLayout: true,
    enableAutoCompaction: true,
    compactionThresholdRatio: 0.7,
    keepLastTurnsCount: 4,
  },
};
