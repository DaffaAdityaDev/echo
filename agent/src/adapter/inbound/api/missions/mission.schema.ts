import { z } from "zod";
import {
  DEFAULT_MISSION_VALUES,
  HITL_DECISIONS,
  MISSION_STRATEGIES,
  STRATEGY_MAPPING,
  VALIDATION_MESSAGES,
} from "./mission.constants";

export const ProviderConfigSchema = z.object({
  type: z.enum(["openai", "anthropic", "lm-studio", "opencode-go"]),
  base_url: z.string(),
  api_key: z.string().nullable().optional(),
  model: z.string(),
});

const MemoryConfigSchema = z
  .object({
    episodic: z.boolean().default(true),
    semantic: z.boolean().default(false),
    procedural: z.boolean().default(false),
    ttl: z.number().default(86400),
  })
  .default({ episodic: true, semantic: false, procedural: false, ttl: 86400 });

const CompressionConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    ratio: z.number().min(0).max(1).default(0.9),
    keepLastTurns: z.number().int().default(2),
  })
  .default({ enabled: true, ratio: 0.9, keepLastTurns: 2 });

const PacingConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    threshold: z.number().int().default(5),
  })
  .default({ enabled: true, threshold: 5 });

const LoopDetectionConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    similarityThreshold: z.number().min(0).max(1).default(0.92),
  })
  .default({ enabled: true, similarityThreshold: 0.92 });

const HarnessConfigSchema = z
  .object({
    compression: CompressionConfigSchema,
    pacing: PacingConfigSchema,
    loopDetection: LoopDetectionConfigSchema,
    maxIterations: z.number().int().default(15),
    costCap: z.number().default(1.0),
    delegationDepth: z.number().int().min(0).max(10).default(0),
  })
  .default({
    compression: { enabled: true, ratio: 0.9, keepLastTurns: 2 },
    pacing: { enabled: true, threshold: 5 },
    loopDetection: { enabled: true, similarityThreshold: 0.92 },
    maxIterations: 15,
    costCap: 1.0,
    delegationDepth: 0,
  });

const CircuitBreakerConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    openAfter: z.number().int().default(3),
    maxRetriesPerTool: z.number().int().default(3),
  })
  .default({ enabled: true, openAfter: 3, maxRetriesPerTool: 3 });

const DegradationConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    degradeAfter: z.number().int().default(3),
    abortAfter: z.number().int().default(7),
  })
  .default({ enabled: true, degradeAfter: 3, abortAfter: 7 });

const ContextResolverConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    classifier: z.enum(["tfidf"]).default("tfidf"),
    hybridSearch: z.boolean().default(false),
  })
  .default({ enabled: true, classifier: "tfidf", hybridSearch: false });

const AgentStatusConfigSchema = z
  .object({
    heartbeatInterval: z.number().int().default(5000),
    stallTimeout: z.number().int().default(10000),
  })
  .default({ heartbeatInterval: 5000, stallTimeout: 10000 });

const HarnessConfigDetailsSchema = z
  .object({
    circuitBreaker: CircuitBreakerConfigSchema,
    degradation: DegradationConfigSchema,
    contextResolver: ContextResolverConfigSchema,
    agentStatus: AgentStatusConfigSchema,
  })
  .default({
    circuitBreaker: { enabled: true, openAfter: 3, maxRetriesPerTool: 3 },
    degradation: { enabled: true, degradeAfter: 3, abortAfter: 7 },
    contextResolver: { enabled: true, classifier: "tfidf", hybridSearch: false },
    agentStatus: { heartbeatInterval: 5000, stallTimeout: 10000 },
  });

export const HarnessFeatureTogglesSchema = z
  .object({
    loopDetection: z
      .object({
        enabled: z.boolean().default(true),
        enableExactMatch: z.boolean().optional(),
        enableCosineSimilarity: z.boolean().optional(),
        maxConsecutiveIdenticalCalls: z.number().int().optional(),
        similarityThreshold: z.number().min(0).max(1).optional(),
        windowSize: z.number().int().optional(),
      })
      .optional(),
    budgetMonitor: z
      .object({
        enabled: z.boolean().default(true),
        enforceMaxSteps: z.boolean().optional(),
        maxSteps: z.number().int().optional(),
        enforceTimeout: z.boolean().optional(),
        maxDurationMs: z.number().int().optional(),
        enforceCostCap: z.boolean().optional(),
        maxCostUsd: z.number().optional(),
      })
      .optional(),
    systemNotices: z
      .object({
        enabled: z.boolean().default(true),
        emitLoopWarnings: z.boolean().optional(),
        emitCompactionNotices: z.boolean().optional(),
        emitBudgetWarnings: z.boolean().optional(),
        emitPacingWarnings: z.boolean().optional(),
      })
      .optional(),
    hitlGuard: z
      .object({
        enabled: z.boolean().default(true),
        protectedTools: z.array(z.string()).optional(),
        ttlMinutes: z.number().int().optional(),
      })
      .optional(),
    contextOptimization: z
      .object({
        enabled: z.boolean().default(true),
        enablePrefixCachingLayout: z.boolean().optional(),
        enableAutoCompaction: z.boolean().optional(),
        compactionThresholdRatio: z.number().min(0).max(1).optional(),
        keepLastTurnsCount: z.number().int().optional(),
      })
      .optional(),
  })
  .optional();

export const AgentConfigSchema = z
  .object({
    provider: ProviderConfigSchema.optional(),
    memory: MemoryConfigSchema,
    harness: HarnessConfigSchema,
    harnessConfig: HarnessConfigDetailsSchema.optional(),
    featureToggles: HarnessFeatureTogglesSchema,
    skills: z.array(z.string()).optional(),
    mcpServers: z
      .array(
        z.object({
          name: z.string(),
          url: z.string(),
          command: z.string().optional(),
          args: z.array(z.string()).optional(),
          transport: z.enum(["sse", "stdio"]).default("sse"),
          credentials: z.record(z.string(), z.string()).optional(),
        }),
      )
      .optional(),
    restTools: z
      .array(
        z.object({
          name: z.string(),
          endpoint: z.string(),
          url: z.string().optional(),
          method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("POST"),
          description: z.string(),
          headers: z.record(z.string(), z.string()).optional(),
          global_headers: z.record(z.string(), z.string()).optional(),
          inputSchema: z.record(z.string(), z.unknown()),
          auth: z
            .object({
              type: z.enum(["bearer", "basic", "header"]),
              credentials: z.record(z.string(), z.string()),
            })
            .optional(),
          timeout: z.number().int().default(30000),
          url_interpolation: z.boolean().default(false),
        }),
      )
      .optional(),
  })
  .default({
    memory: { episodic: true, semantic: false, procedural: false, ttl: 86400 },
    harness: {
      compression: { enabled: true, ratio: 0.9, keepLastTurns: 2 },
      pacing: { enabled: true, threshold: 5 },
      loopDetection: { enabled: true, similarityThreshold: 0.92 },
      maxIterations: 15,
      costCap: 1.0,
      delegationDepth: 0,
    },
    harnessConfig: {
      circuitBreaker: { enabled: true, openAfter: 3, maxRetriesPerTool: 3 },
      degradation: { enabled: true, degradeAfter: 3, abortAfter: 7 },
      contextResolver: { enabled: true, classifier: "tfidf", hybridSearch: false },
      agentStatus: { heartbeatInterval: 5000, stallTimeout: 10000 },
    },
  });

export const createMissionSchema = z.preprocess(
  (input: unknown) => {
    if (!input || typeof input !== "object") return input;
    const raw = input as Record<string, unknown>;

    const rawStrategyVersion = String(raw.strategy_version || raw.strategyVersion || "")
      .toLowerCase()
      .trim();
    const rawStrategy = String(
      raw.strategy_version || raw.strategyVersion || raw.strategy || raw.mode || DEFAULT_MISSION_VALUES.STRATEGY,
    ).toLowerCase();
    let strategy: (typeof MISSION_STRATEGIES)[number] = DEFAULT_MISSION_VALUES.STRATEGY;
    if (STRATEGY_MAPPING.standard.includes(rawStrategy)) {
      strategy = "standard";
    } else {
      strategy = "agent";
    }

    const userIdRaw = raw.userId ?? raw.user_id;
    const tenantIdRaw = raw.tenantId ?? raw.tenant_id;
    const orgIdRaw = raw.orgId ?? raw.org_id;

    return {
      ...raw,
      strategy,
      strategy_version: rawStrategyVersion || undefined,
      prompt: raw.prompt || raw.message,
      tenantId: tenantIdRaw != null ? String(tenantIdRaw) : DEFAULT_MISSION_VALUES.TENANT_ID,
      userId: userIdRaw != null ? String(userIdRaw) : DEFAULT_MISSION_VALUES.USER_ID,
      orgId: orgIdRaw != null ? String(orgIdRaw) : DEFAULT_MISSION_VALUES.ORG_ID,
      history: raw.history ?? undefined,
      features: raw.features ?? undefined,
      skills: raw.skills ?? undefined,
      missionId: raw.missionId ?? undefined,
      model: raw.model ?? undefined,
      prompt_template: raw.prompt_template ?? undefined,
      config: raw.config,
    };
  },
  z.object({
    prompt: z.string({ message: VALIDATION_MESSAGES.PROMPT_REQUIRED }),
    strategy: z.enum(MISSION_STRATEGIES),
    strategy_version: z.string().optional(),
    tenantId: z.string(),

    userId: z.string(),
    orgId: z.string(),
    missionId: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    prompt_template: z.string().nullable().optional(),
    provider_config: z.object({
      type: z.enum(["openai", "anthropic", "lm-studio", "opencode-go"]),
      base_url: z.string(),
      api_key: z.string().nullable().optional(),
      model: z.string(),
    }),
    features: z.array(z.string()).nullable().optional(),
    skills: z.array(z.string()).nullable().optional(),
    history: z
      .array(
        z.object({
          role: z.string(),
          content: z.string(),
        }),
      )
      .nullable()
      .optional(),
    config: AgentConfigSchema,
  }),
);

export type CreateMissionInput = z.infer<typeof createMissionSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const hitlDecisionSchema = z.object({
  approvalId: z.string(),
  decision: z.enum([HITL_DECISIONS.APPROVE, HITL_DECISIONS.DENY]),
  reason: z.string().optional(),
});

export type HitlDecisionInput = z.infer<typeof hitlDecisionSchema>;
