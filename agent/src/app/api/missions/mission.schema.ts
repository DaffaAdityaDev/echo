import { z } from 'zod';
import { 
  MISSION_STRATEGIES, 
  DEFAULT_MISSION_VALUES, 
  STRATEGY_MAPPING, 
  VALIDATION_MESSAGES 
} from './mission.constants';

export const ProviderConfigSchema = z.object({
  type: z.enum(['openai', 'anthropic', 'lm-studio', 'opencode-go']),
  base_url: z.string(),
  api_key: z.string().nullable().optional(),
  model: z.string(),
});

const MemoryConfigSchema = z.object({
  episodic: z.boolean().default(true),
  semantic: z.boolean().default(false),
  procedural: z.boolean().default(false),
  ttl: z.number().default(86400),
}).default({ episodic: true, semantic: false, procedural: false, ttl: 86400 });

const CompressionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  ratio: z.number().min(0).max(1).default(0.8),
  keepLastTurns: z.number().int().default(10),
}).default({ enabled: true, ratio: 0.8, keepLastTurns: 10 });

const PacingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  threshold: z.number().int().default(5),
}).default({ enabled: true, threshold: 5 });

const LoopDetectionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  similarityThreshold: z.number().min(0).max(1).default(0.92),
}).default({ enabled: true, similarityThreshold: 0.92 });

const HarnessConfigSchema = z.object({
  compression: CompressionConfigSchema,
  pacing: PacingConfigSchema,
  loopDetection: LoopDetectionConfigSchema,
  maxIterations: z.number().int().default(15),
  costCap: z.number().default(1.0),
}).default({
  compression: { enabled: true, ratio: 0.8, keepLastTurns: 10 },
  pacing: { enabled: true, threshold: 5 },
  loopDetection: { enabled: true, similarityThreshold: 0.92 },
  maxIterations: 15,
  costCap: 1.0,
});

const CircuitBreakerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  openAfter: z.number().int().default(3),
  maxRetriesPerTool: z.number().int().default(3),
}).default({ enabled: true, openAfter: 3, maxRetriesPerTool: 3 });

const DegradationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  degradeAfter: z.number().int().default(3),
  abortAfter: z.number().int().default(7),
}).default({ enabled: true, degradeAfter: 3, abortAfter: 7 });

const ContextResolverConfigSchema = z.object({
  enabled: z.boolean().default(true),
  classifier: z.enum(['tfidf']).default('tfidf'),
  hybridSearch: z.boolean().default(false),
}).default({ enabled: true, classifier: 'tfidf', hybridSearch: false });

const AgentStatusConfigSchema = z.object({
  heartbeatInterval: z.number().int().default(5000),
  stallTimeout: z.number().int().default(10000),
}).default({ heartbeatInterval: 5000, stallTimeout: 10000 });

const HarnessConfigDetailsSchema = z.object({
  circuitBreaker: CircuitBreakerConfigSchema,
  degradation: DegradationConfigSchema,
  contextResolver: ContextResolverConfigSchema,
  agentStatus: AgentStatusConfigSchema,
}).default({
  circuitBreaker: { enabled: true, openAfter: 3, maxRetriesPerTool: 3 },
  degradation: { enabled: true, degradeAfter: 3, abortAfter: 7 },
  contextResolver: { enabled: true, classifier: 'tfidf', hybridSearch: false },
  agentStatus: { heartbeatInterval: 5000, stallTimeout: 10000 },
});

export const AgentConfigSchema = z.object({
  provider: ProviderConfigSchema.optional(),
  memory: MemoryConfigSchema,
  harness: HarnessConfigSchema,
  harnessConfig: HarnessConfigDetailsSchema.optional(),
  skills: z.array(z.string()).optional(),
  mcpServers: z.array(z.object({
    name: z.string(),
    url: z.string(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    transport: z.enum(['sse', 'stdio']).default('sse'),
    credentials: z.record(z.string(), z.string()).optional(),
  })).optional(),
  restTools: z.array(z.object({
    name: z.string(),
    endpoint: z.string(),
    url: z.string().optional(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('POST'),
    description: z.string(),
    headers: z.record(z.string(), z.string()).optional(),
    global_headers: z.record(z.string(), z.string()).optional(),
    inputSchema: z.record(z.string(), z.unknown()),
    auth: z.object({
      type: z.enum(['bearer', 'basic', 'header']),
      credentials: z.record(z.string(), z.string()),
    }).optional(),
    timeout: z.number().int().default(30000),
    url_interpolation: z.boolean().default(false),
  })).optional(),
}).default({
  memory: { episodic: true, semantic: false, procedural: false, ttl: 86400 },
  harness: {
    compression: { enabled: true, ratio: 0.8, keepLastTurns: 10 },
    pacing: { enabled: true, threshold: 5 },
    loopDetection: { enabled: true, similarityThreshold: 0.92 },
    maxIterations: 15,
    costCap: 1.0,
  },
  harnessConfig: {
    circuitBreaker: { enabled: true, openAfter: 3, maxRetriesPerTool: 3 },
    degradation: { enabled: true, degradeAfter: 3, abortAfter: 7 },
    contextResolver: { enabled: true, classifier: 'tfidf', hybridSearch: false },
    agentStatus: { heartbeatInterval: 5000, stallTimeout: 10000 },
  },
});

export const createMissionSchema = z.preprocess((input: any) => {
  if (!input || typeof input !== 'object') return input;

  const rawStrategy = String(input.strategy || input.mode || DEFAULT_MISSION_VALUES.STRATEGY).toLowerCase();
  let strategy: typeof MISSION_STRATEGIES[number] = DEFAULT_MISSION_VALUES.STRATEGY;
  if (STRATEGY_MAPPING.standard.includes(rawStrategy)) {
    strategy = 'standard';
  } else {
    strategy = 'agent';
  }

  const userIdRaw = input.userId ?? input.user_id;
  const tenantIdRaw = input.tenantId ?? input.tenant_id;
  const orgIdRaw = input.orgId ?? input.org_id;

  return {
    ...input,
    strategy,
    prompt: input.prompt || input.message,
    tenantId: tenantIdRaw != null ? String(tenantIdRaw) : DEFAULT_MISSION_VALUES.TENANT_ID,
    userId: userIdRaw != null ? String(userIdRaw) : DEFAULT_MISSION_VALUES.USER_ID,
    orgId: orgIdRaw != null ? String(orgIdRaw) : DEFAULT_MISSION_VALUES.ORG_ID,
    history: input.history ?? undefined,
    features: input.features ?? undefined,
    skills: input.skills ?? undefined,
    missionId: input.missionId ?? undefined,
    model: input.model ?? undefined,
    config: input.config ?? {},
  };
}, z.object({
  prompt: z.string({ message: VALIDATION_MESSAGES.PROMPT_REQUIRED }),
  strategy: z.enum(MISSION_STRATEGIES),
  tenantId: z.string(),
  userId: z.string(),
  orgId: z.string(),
  missionId: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  provider_config: z.object({
    type: z.enum(['openai', 'anthropic', 'lm-studio', 'opencode-go']),
    base_url: z.string(),
    api_key: z.string().nullable().optional(),
    model: z.string(),
  }),
  features: z.array(z.string()).nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
  history: z.array(
    z.object({
      role: z.string(),
      content: z.string()
    })
  ).nullable().optional(),
  config: AgentConfigSchema,
}));

export type CreateMissionInput = z.infer<typeof createMissionSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
