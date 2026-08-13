import type { RestToolConfig } from "../../../infrastructure/transports/rest/types";
import type { AgentStrategy, HarnessFeatureToggles, LLMProvider, ToolDefinition } from "../../../shared/types";
import type { BehaviorPrompt } from "../prompts";

export type HarnessEventType =
  | "metadata"
  | "reasoning"
  | "content"
  | "tool_call"
  | "tool_result"
  | "tool_skip"
  | "todo"
  | "subagent_call"
  | "subagent_result"
  | "usage"
  | "progress"
  | "heartbeat"
  | "state_change"
  | "degraded"
  | "turn_complete"
  | "debug"
  | "system_notice"
  | "error"
  | "swarm_status"
  | "token_metrics"
  | "hitl_approval_required"
  | "mission_completed";

export type HarnessEvent = {
  type: HarnessEventType;
  missionId: string;
  step?: number;
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

export interface HarnessRuntimeConfig {
  circuitBreaker?: {
    enabled?: boolean;
    openAfter?: number;
    maxRetriesPerTool?: number;
  };
  degradation?: {
    enabled?: boolean;
    degradeAfter?: number;
    abortAfter?: number;
  };
  agentStatus?: {
    heartbeatInterval?: number;
    stallTimeout?: number;
  };
}

export interface HarnessConfig {
  provider: LLMProvider;
  strategy: AgentStrategy;
  missionId?: string;
  tenantId?: string;
  harnessType?: string;
  tools?: ToolDefinition[];
  skills?: string[];
  /** REST tool configs scoped to this mission; rebuilt into tools per run. */
  restTools?: RestToolConfig[];
  harnessConfig?: Partial<HarnessFeatureToggles> & HarnessRuntimeConfig;
  delegationDepth?: number;
  initialCostUsd?: number;
  behaviorPrompt?: BehaviorPrompt | null;
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
