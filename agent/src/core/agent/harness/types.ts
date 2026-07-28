import {
  AgentState,
  type AgentStrategy,
  type HarnessFeatureToggles,
  type LLMProvider,
  type ToolDefinition,
} from "../../../shared/types";

export interface HarnessConfig {
  provider: LLMProvider;
  strategy: AgentStrategy;
  missionId?: string;
  tenantId?: string;
  harnessType?: string;
  tools?: ToolDefinition[];
  skills?: string[];
  harnessConfig?: any;
  delegationDepth?: number;
  initialCostUsd?: number;
}

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
