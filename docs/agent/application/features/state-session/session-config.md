===============================================================================
  Session Config - Per-Session Agent Configuration
===============================================================================
  Module    : Session Configuration
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
===============================================================================

## Description

The Session Config defines all configurable parameters for a single agent
mission. Every harness parameter — provider, features, memory, skill,
transports — can be set per session. Session config is ephemeral; persistent
config provides defaults that sessions can override.

---

## Config Flow

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │                         Config Flow                                       │
  │                                                                           │
  │  ┌──────────────┐     ┌──────────────┐     ┌───────────────────────────┐ │
  │  │  Frontend     │────►│  Backend API │────►│  Agent Session            │ │
  │  │  (UI/CLI)     │     │  (Go/Node)   │     │                           │ │
  │  └──────────────┘     └──────────────┘     │  ┌───────────────────────┐│ │
  │       │                                     │  │  SessionConfig        ││ │
  │       │  {                                  │  │                       ││ │
  │       │    prompt: "Find latest...",         │  │  provider OpenAI     ││ │
  │       │    strategy: "agent",                │  │  strategy agent      ││ │
  │       │    strategy_version: "nlah:v1",      │  │  skills research     ││ │
  │       │    skills: ["research"],             │  │  tools [web_search,  ││ │
  │       │    provider_config: {...},           │  │    write_todos]      ││ │
  │       │    config: {                         │  │  mcpServers [...]    ││ │
  │       │      mcpServers: [...],              │  │  restTools [...]     ││ │
  │       │      restTools: [...],               │  │  credentials $env    ││ │
  │       │      memory: {...},                  │  │  memory {...}        ││ │
  │       │      harness: {                      │  │  harness {...}       ││ │
  │       │        maxIterations: 20,            │  └───────────────────────┘│
  │       │        costCap: 2.00                 │                           │
  │       │      }                               │                           │
  │       │    }                                 │                           │
  │       │                                     │  AgentHarness(            │
  │       │                                     │    config.provider,        │
  │       │                                     │    config.strategy,        │
  │       │                                     │    config.tools,           │
  │       │                                     │    config.harness          │
  │       │                                     │  ) → runMission()          │
  └───────┼─────────────────────────────────────┼───────────────────────────┘
          │                                     │
          ▼                                     ▼
  ┌────────────────┐               ┌───────────────────────────────────────┐
  │  Persistent    │               │  Session (ephemeral)                  │
  │  Config        │               │                                       │
  │  (server.env)  │               │  Created per request, discarded       │
  │                │               │  after mission completes              │
  │  PORT          │               │  Overrides persistent defaults        │
  │  CHROMA_URL    │               │                                       │
  │  LANGFUSE_KEY  │               │  Contains:                            │
  │  ...           │               │  - Provider credentials (transient)   │
  └────────────────┘               │  - Tool/transport config              │
                                   │  - Skill assignment                   │
                                   │  - Memory/state config                │
                                   │  - Harness overrides                  │
                                   └───────────────────────────────────────┘
```

---

## Zod Schema

The mission request schema is defined in `adapter/inbound/api/missions/mission.schema.ts`
and validated per-request at the controller level. The schema wraps a
`z.preprocess()` that normalizes snake_case aliases (`user_id` → `userId`,
`strategy_version`/`strategyVersion` → `strategy_version`, `message` →
`prompt`) and applies the mission defaults (`strategy: "agent"`,
`tenantId: "local-developer"`, `userId: "local-dev-user"`,
`orgId: "local-org"`).

```typescript
import { z } from 'zod';

export const createMissionSchema = z.preprocess(/* normalize aliases + defaults */, z.object({
  prompt: z.string({ message: "Either 'prompt' or 'message' field is required" }),
  strategy: z.enum(['standard', 'agent']),
  strategy_version: z.string().optional(),
  tenantId: z.string(),
  userId: z.string(),
  orgId: z.string(),
  sessionId: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  provider_config: z.object({
    type: z.enum(['openai', 'anthropic', 'lm-studio', 'opencode-go']),
    base_url: z.string(),            // plain string — not .url() validated
    api_key: z.string().nullable().optional(),
    model: z.string(),
  }),                                // REQUIRED
  features: z.array(z.string()).nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
  history: z.array(z.object({
    role: z.string(),                // plain string, not an enum
    content: z.string(),
  })).nullable().optional(),
  config: AgentConfigSchema,         // nested session config (camelCase)
}));
```

The `config` object nests memory, harness, harnessConfig, featureToggles,
skills, mcpServers and restTools:

```typescript
const AgentConfigSchema = z.object({
  provider: ProviderConfigSchema.optional(),
  memory: z.object({
    episodic: z.boolean().default(true),
    semantic: z.boolean().default(false),
    procedural: z.boolean().default(false),
    ttl: z.number().default(86400),
  }).default({ episodic: true, semantic: false, procedural: false, ttl: 86400 }),
  harness: z.object({
    compression: z.object({
      enabled: z.boolean().default(true),
      ratio: z.number().min(0).max(1).default(0.9),        // 0.9, not 0.8
      keepLastTurns: z.number().int().default(2),          // 2, not 10
    }).default({ enabled: true, ratio: 0.9, keepLastTurns: 2 }),
    pacing: z.object({ enabled: z.boolean().default(true), threshold: z.number().int().default(5) })
      .default({ enabled: true, threshold: 5 }),
    loopDetection: z.object({ enabled: z.boolean().default(true), similarityThreshold: z.number().min(0).max(1).default(0.92) })
      .default({ enabled: true, similarityThreshold: 0.92 }),
    maxIterations: z.number().int().default(15),
    costCap: z.number().default(1.0),
    delegationDepth: z.number().int().min(0).max(10).default(0),
  }).default({...}),
  harnessConfig: z.object({   // optional
    circuitBreaker: z.object({ enabled: z.boolean().default(true), openAfter: z.number().int().default(3), maxRetriesPerTool: z.number().int().default(3) }),
    degradation: z.object({ enabled: z.boolean().default(true), degradeAfter: z.number().int().default(3), abortAfter: z.number().int().default(7) }),
    contextResolver: z.object({ enabled: z.boolean().default(true), classifier: z.enum(['tfidf']).default('tfidf'), hybridSearch: z.boolean().default(false) }),
    agentStatus: z.object({ heartbeatInterval: z.number().int().default(5000), stallTimeout: z.number().int().default(10000) }),
  }).default({...}),
  featureToggles: HarnessFeatureTogglesSchema.optional(),
  skills: z.array(z.string()).optional(),
  mcpServers: z.array(z.object({
    name: z.string(),
    url: z.string(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    transport: z.enum(['sse', 'stdio']).default('sse'),
    credentials: z.record(z.string(), z.string()).optional(),
  })).optional(),                  // no timeout field
  restTools: z.array(z.object({
    name: z.string(),
    endpoint: z.string(),          // REQUIRED
    url: z.string().optional(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('POST'),
    description: z.string(),       // REQUIRED
    headers: z.record(z.string(), z.string()).optional(),
    global_headers: z.record(z.string(), z.string()).optional(),
    inputSchema: z.record(z.string(), z.unknown()),   // REQUIRED
    auth: z.object({ type: z.enum(['bearer', 'basic', 'header']), credentials: z.record(z.string(), z.string()) }).optional(),
    timeout: z.number().int().default(30000),
    url_interpolation: z.boolean().default(false),
  })).optional(),
}).default({...});
```

There are no `skill` / `skill_variables` fields — skills are passed as the
`skills: string[]` array at the top level.

---

## Complete Parameter Table

+----------------------------+--------------+-----------------------------+------------------------------------------+
| Parameter                  | Type         | Default                     | Description                              |
+----------------------------+--------------+-----------------------------+------------------------------------------+
| **prompt**                 | `string`     | (required)                  | User's mission objective                 |
| **strategy**               | `enum`       | `"agent"`                   | Execution mode ("standard" | "agent")    |
| **strategy_version**       | `string`     | (optional)                  | Pinned strategy version, e.g. "nlah:v1"  |
|                            |              |                             |                                          |
| **provider_config.type**   | `enum`       | (required)                  | LLM provider                             |
| **provider_config.**      | `string`     | (required)                  | Provider API base URL (plain string)     |
| **base_url**               |              |                             |                                          |
| **provider_config.**      | `string`     | (optional)                  | Provider API key (if needed)             |
| **api_key**                |              |                             |                                          |
| **provider_config.model**  | `string`     | (required)                  | Model name (e.g. gpt-4o)                |
|                            |              |                             |                                          |
| **features**               | `string[]`   | `[]`                        | Feature/tool IDs to enable; empty = ToolRetriever selects from full pool |
|                            |              |                             |                                          |
| **skills**                 | `string[]`   | (optional)                  | Skill names — filtered at the top level (no `skill`/`skill_variables` fields) |
|                            |              |                             |                                          |
| **config.mcpServers[].name**| `string`     | (required)                  | Logical MCP server name                  |
| **config.mcpServers[].url** | `string`     | (required)                  | SSE endpoint URL (or stdio command)      |
| **config.mcpServers[].**   | `enum`       | `"sse"`                     | Connection transport                     |
| **transport**              |              |                             |                                          |
| **config.mcpServers[].**   | `string[]`   | (optional)                  | stdio spawn arguments                    |
| **args**                   |              |                             |                                          |
| **config.mcpServers[].**   | `object`     | (optional)                  | Credentials via $env refs                |
| **credentials**            |              |                             |                                          |
|                            |              |                             | (no timeout field)                       |
| **config.restTools[].name**| `string`     | (required)                  | Tool name for agent                      |
| **config.restTools[].**    | `string`     | (required)                  | API endpoint                             |
| **endpoint**               |              |                             |                                          |
| **config.restTools[].url** | `string`     | (optional)                  | Override URL                             |
| **config.restTools[].method**| `enum`     | `"POST"`                    | HTTP method                              |
| **config.restTools[].**    | `object`     | (required)                  | Input schema (record)                    |
| **inputSchema**            |              |                             |                                          |
| **config.restTools[].**    | `object`     | (optional)                  | Static + $env ref headers                |
| **global_headers**         |              |                             |                                          |
| **config.restTools[].**    | `boolean`    | `false`                     | Enable URL interpolation                  |
| **url_interpolation**      |              |                             |                                          |
| **config.restTools[].timeout**| `number`  | `30000`                     | Request timeout (ms)                     |
| **config.restTools[].auth**| `object`     | (optional)                  | Bearer/Basic/Header auth                 |
|                            |              |                             |                                          |
| **config.memory**          | `object`     | `{episodic: true, semantic: false, procedural: false, ttl: 86400}` | Memory subsystem flags |
|                            |              |                             |                                          |
| **config.harness.maxIterations** | `number` | `15`                        | Max execution loop turns                 |
| **config.harness.costCap** | `number`     | `1.00`                      | Max spend in USD before abort            |
| **config.harness.**        | `number`     | `0.9`                       | Token ratio triggering compaction        |
| **compression.ratio**      |              |                             |                                          |
| **config.harness.**        | `number`     | `2`                         | Turns preserved after compaction         |
| **compression.keepLastTurns**|           |                             |                                          |
| **config.harness.pacing.** | `number`     | `5`                         | Iterations before forced synthesis       |
| **threshold**              |              |                             |                                          |
| **config.harness.**        | `number`     | `0.92`                      | Cosine similarity loop detection         |
| **loopDetection.similarityThreshold**| |                             |                                          |
|                            |              |                             |                                          |
| **tenantId**               | `string`     | `"local-developer"`         | Enterprise account partition             |
| **userId**                 | `string`     | `"local-dev-user"`          | Triggering user identity                 |
| **orgId**                  | `string`     | `"local-org"`               | Billing organization partition           |
+----------------------------+--------------+-----------------------------+------------------------------------------+

---

## Per-Session vs Persistent Config

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  Persistent Config (env / file)                                           │
│  ─────────────────────────────                                            │
│  Loaded once at agent startup                                            │
│  Stored in .env, config files, env schema                                │
│                                                                           │
│  PORT, GRPC_PORT, CHROMA_URL, LANGFUSE_*                                 │
│  Default model, default provider                                         │
│  Internal auth tokens                                                    │
│  Runtime mode (local/production)                                         │
│                                                                           │
│  ── Not overridable per session ──                                       │
│  ── Infrastructure concerns ──                                           │
│                                                                           │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ MERGED
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│  Session Config (API payload)                                            │
│  ────────────────────────────                                             │
│  Created per API request                                                  │
│  Passed in POST /generate-mission body                                    │
│                                                                           │
  │  prompt, strategy, strategy_version, skills │
  │  provider_config (model, URL, key)          │
  │  config.mcpServers, config.restTools        │
  │  features, history                          │
  │  config.harness overrides                   │
│                                                                           │
│  ── Overrides persistent defaults ──                                      │
│  ── Ephemeral — discarded after mission ──                                │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Example JSON Config

```json
{
  "prompt": "Analyze the latest Q3 earnings reports for tech companies and identify market trends.",
  "strategy": "agent",
  "strategy_version": "nlah:v1",
  "skills": ["analyst"],

  "provider_config": {
    "type": "openai",
    "base_url": "https://api.openai.com/v1",
    "model": "gpt-4o"
  },

  "features": ["web_search", "write_todos"],

  "config": {
    "memory": {
      "episodic": true,
      "semantic": false,
      "procedural": false,
      "ttl": 86400
    },
    "harness": {
      "compression": {
        "enabled": true,
        "ratio": 0.9,
        "keepLastTurns": 2
      },
      "pacing": { "enabled": true, "threshold": 5 },
      "loopDetection": { "enabled": true, "similarityThreshold": 0.92 },
      "maxIterations": 25,
      "costCap": 0.50,
      "delegationDepth": 0
    },
    "mcpServers": [
      {
        "name": "financial-data",
        "transport": "sse",
        "url": "https://mcp.finance.example.com/sse",
        "credentials": {
          "api_key": "$env.FINANCE_MCP_KEY"
        }
      }
    ],
    "restTools": [
      {
        "name": "get_stock_data",
        "endpoint": "https://api.example.com/stocks/{ticker}",
        "method": "GET",
        "description": "Fetch current stock price and historical data for a ticker symbol",
        "inputSchema": {
          "ticker": { "type": "string", "description": "Stock ticker symbol" },
          "period": { "type": "string", "enum": ["1d", "1w", "1m", "1y"] }
        },
        "auth": {
          "type": "bearer",
          "credentials": {
            "token": "$env.STOCK_API_TOKEN"
          }
        },
        "timeout": 30000,
        "url_interpolation": false
      }
    ]
  },

  "history": [
    { "role": "user", "content": "I need a financial analysis of tech stocks." },
    { "role": "assistant", "content": "I can help with that. What specific metrics are you interested in?" }
  ],

  "sessionId": "session-abc-123"
}
```

---

## Entry Points & Exports

+----------------------------+------------------------------------------+--------------------------------------------+
| Export                     | Source                                   | Type                                       |
+----------------------------+------------------------------------------+--------------------------------------------+
| `createMissionSchema`      | `adapter/inbound/api/missions/mission.schema.ts` | Zod validation schema                      |
| `HarnessEvent`             | `core/agent/harness/types.ts`             | Packet event type                          |
| `HarnessRuntimeConfig`     | `core/agent/harness/types.ts`             | Runtime overrides (circuit breaker, degradation, agent status) |
| `HarnessConfig`            | `core/agent/harness/types.ts`             | Full harness construction config           |
| `DEFAULT_HARNESS_TOGGLES`  | `core/agent/harness/types.ts`             | Default feature toggle values              |
+----------------------------+------------------------------------------+--------------------------------------------+

---

## Dependencies

+----------------------+--------------------------------------------------------------+
| Dependency           | Purpose                                                      |
+----------------------+--------------------------------------------------------------+
| `zod`                | Config schema validation with defaults                       |
| `shared/types`       | `ProviderConnectionConfig`, `MissionPayload`                 |
| `env.schema.ts`      | Persistent env defaults merged with session config           |
| `mission.schema.ts`  | Request-level schema (subset of session config)              |
+----------------------+--------------------------------------------------------------+

---

## Source References

+----------------------------+------------------------------------------+---------------------------------------------+
| Ref                        | File                                     | Key Lines                                   |
+----------------------------+------------------------------------------+---------------------------------------------+
| Persistent env schema      | `config/env.schema.ts:8-29`              | PORT, GRPC_PORT, CHROMA_URL, LANGFUSE_*    |
| Mission schema             | `adapter/inbound/api/missions/mission.schema.ts` | Full mission request validation            |
| Provider config dispatch   | `infrastructure/providers/factory.ts:24-27`| `fromConfig()` reads session provider config|
| Harness defaults           | `harness/constants.ts`              | MAX_ITERATIONS, COMPACTION_RATIO, etc.      |
| Stream transport           | `adapter/inbound/api/missions/stream.transport.ts` | Packet serialization                        |
+----------------------------+------------------------------------------+---------------------------------------------+

===============================================================================
  (c) 2026 Echo - All Rights Reserved
===============================================================================
