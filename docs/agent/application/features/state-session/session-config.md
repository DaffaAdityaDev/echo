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
  │       │    strategy: "nlah", // agent mode  │  │  strategy nlah        ││ │
  │       │    skill: "research",               │  │  skill research       ││ │
  │       │    provider_config: {...},           │  │  tools [web_search,  ││ │
  │       │    mcp_servers: [...],              │  │    write_todos]       ││ │
  │       │    rest_tools: [...],               │  │  mcp_servers [...]    ││ │
  │       │    features: ["web_search",         │  │  rest_tools [...]     ││ │
  │       │      "write_todos"],                 │  │  credentials $env    ││ │
  │       │    memory: {...},                    │  │  memory {...}        ││ │
  │       │    harness: {                        │  │  harness {...}       ││ │
  │       │      max_iterations: 20,            │  └───────────────────────┘│
  │       │      cost_threshold: 2.00            │                           │
  │       │    }                                 │                           │
  │       │  }                                   │                           │
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

```typescript
import { z } from 'zod';

export const SessionConfigSchema = z.object({
  // ── Mission ──
  prompt: z.string().min(1),
  strategy: z.enum(['standard', 'agent']).default('agent'),
  skill: z.string().optional(),
  skill_variables: z.record(z.string()).optional(),

  // ── Provider ──
  provider_config: z.object({
    type: z.enum(['openai', 'anthropic', 'lm-studio', 'opencode-go']),
    base_url: z.string().url(),
    api_key: z.string().optional(),
    model: z.string(),
  }),

  // ── Tools / Features (string IDs from ACTIVE_FEATURES) ──
  features: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),

  // ── MCP Transports ──
  mcp_servers: z.array(z.object({
    name: z.string(),
    transport: z.enum(['sse', 'stdio']),
    url: z.string().optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    credentials: z.record(z.string()).optional(),
    timeout: z.number().positive().optional(),
  })).optional(),

  // ── REST Transports ──
  rest_tools: z.array(z.object({
    name: z.string(),
    description: z.string(),
    url: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).optional(),
    headers: z.record(z.string()).optional(),
    auth: z.object({
      type: z.enum(['bearer', 'basic', 'header']),
      credentials: z.record(z.string()),
    }).optional(),
    schema: z.object({
      type: z.literal('object'),
      properties: z.record(z.any()),
      required: z.array(z.string()).optional(),
    }).optional(),
  })).optional(),

  // ── Memory / History ──
  history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(),
  missionId: z.string().optional(),

  // ── Harness Overrides ──
  harness: z.object({
    max_iterations: z.number().int().positive().optional(),
    cost_threshold: z.number().positive().optional(),
    compaction_ratio: z.number().min(0).max(1).optional(),
    pacing_threshold: z.number().int().positive().optional(),
    similarity_threshold: z.number().min(0).max(1).optional(),
    keep_last_turns: z.number().int().positive().optional(),
  }).optional(),

  // ── Tenant ──
  tenantId: z.string().default('local'),
  userId: z.string().default('anonymous'),
  orgId: z.string().default('local'),
});
```

---

## Complete Parameter Table

+----------------------------+--------------+-----------------------------+------------------------------------------+
| Parameter                  | Type         | Default                     | Description                              |
+----------------------------+--------------+-----------------------------+------------------------------------------+
| **prompt**                 | `string`     | (required)                  | User's mission objective                 |
| **strategy**               | `enum`       | `"nlah"` (internal default when mode="agent") | Execution mode                           |
| **skill**                  | `string`     | `"reasoning"`               | Behavioral pattern                       |
| **skill_variables**        | `object`     | `{}`                        | Template variables for the skill         |
|                            |              |                             |                                          |
| **provider_config.type**   | `enum`       | (required)                  | LLM provider                             |
| **provider_config.**      | `string`     | (required)                  | Provider API base URL                    |
| **base_url**               |              |                             |                                          |
| **provider_config.**      | `string`     | (optional)                  | Provider API key (if needed)             |
| **api_key**                |              |                             |                                          |
| **provider_config.model**  | `string`     | (required)                  | Model name (e.g. gpt-4o)                |
|                            |              |                             |                                          |
| **features**               | `string[]`   | `[]`                        | Feature/tool IDs to enable; empty = ToolRetriever selects from full pool |
|                            |              |                             |                                          |
| **skills**                 | `string[]`   | `[]`                        | Skill names — preferredTools merged with features |
|                            |              |                             |                                          |
| **mcp_servers[].name**     | `string`     | (optional)                  | Logical MCP server name                  |
| **mcp_servers[].**        | `enum`       | `"sse"`                     | Connection transport                     |
| **transport**              |              |                             |                                          |
| **mcp_servers[].url**      | `string`     | (optional)                  | SSE endpoint URL                         |
| **mcp_servers[].command**  | `string`     | (optional)                  | stdio spawn command                      |
| **mcp_servers[].**        | `string[]`   | `[]`                        | stdio spawn arguments                    |
| **args**                   |              |                             |                                          |
| **mcp_servers[].**        | `object`     | `{}`                        | Credentials via $env refs                |
| **credentials**            |              |                             |                                          |
| **mcp_servers[].timeout**  | `number`     | `30000`                     | Connection timeout (ms)                  |
|                            |              |                             |                                          |
| **rest_tools[].name**      | `string`     | (optional)                  | Tool name for agent                      |
| **rest_tools[].url**       | `string`     | (required)                  | API endpoint URL                         |
| **rest_tools[].method**    | `enum`       | `"POST"`                    | HTTP method                              |
| **rest_tools[].headers**   | `object`     | `{}`                        | Static + $env ref headers                |
| **rest_tools[].auth**      | `object`     | (optional)                  | Bearer/Basic/Header auth                 |
| **rest_tools[].schema**    | `object`     | `{ type: "object" }`       | JSON Schema for tool inputs              |
|                            |              |                             |                                          |
| **history**                | `array`      | `[]`                        | Previous conversation messages           |
| **missionId**              | `string`     | (auto UUID)                 | Resume existing mission                  |
|                            |              |                             |                                          |
| **harness.max_iterations** | `number`     | `15`                        | Max execution loop turns                 |
| **harness.cost_threshold** | `number`     | `1.00`                      | Max spend in USD before abort            |
| **harness.**              | `number`     | `0.9`                       | Token ratio triggering compaction        |
| **compaction_ratio**       |              |                             |                                          |
| **harness.**              | `number`     | `5`                         | Iterations before forced synthesis       |
| **pacing_threshold**       |              |                             |                                          |
| **harness.**              | `number`     | `0.92`                      | Cosine similarity loop detection         |
| **similarity_threshold**   |              |                             |                                          |
| **harness.keep_last_turns**| `number`     | `10`                        | Turns preserved after compaction         |
|                            |              |                             |                                          |
| **tenantId**               | `string`     | `"local"`                  | Enterprise account partition             |
| **userId**                 | `string`     | `"anonymous"`               | Triggering user identity                 |
| **orgId**                  | `string`     | `"local"`                  | Billing organization partition           |
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
│  prompt, strategy, skill                                                  │
│  provider_config (model, URL, key)                                        │
│  mcp_servers, rest_tools                                                  │
│  features, history                                                        │
│  harness overrides                                                        │
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
  "strategy": "nlah",
  "skill": "analyst",
  "skill_variables": {
    "domain": "financial technology",
    "data_formats": "CSV, JSON, HTML reports"
  },

  "provider_config": {
    "type": "openai",
    "base_url": "https://api.openai.com/v1",
    "model": "gpt-4o"
  },

  "features": ["web_search", "write_todos"],
  "skills": ["analyst"],

  "mcp_servers": [
    {
      "name": "financial-data",
      "transport": "sse",
      "url": "https://mcp.finance.example.com/sse",
      "credentials": {
        "api_key": "$env.FINANCE_MCP_KEY"
      }
    }
  ],

  "rest_tools": [
    {
      "name": "get_stock_data",
      "description": "Fetch current stock price and historical data for a ticker symbol",
      "url": "https://api.example.com/stocks/{ticker}",
      "method": "GET",
      "auth": {
        "type": "bearer",
        "credentials": {
          "token": "$env.STOCK_API_TOKEN"
        }
      },
      "schema": {
        "type": "object",
        "properties": {
          "ticker": { "type": "string", "description": "Stock ticker symbol" },
          "period": { "type": "string", "enum": ["1d", "1w", "1m", "1y"] }
        },
        "required": ["ticker"]
      }
    }
  ],

  "harness": {
    "max_iterations": 25,
    "cost_threshold": 0.50,
    "similarity_threshold": 0.95
  },

  "history": [
    { "role": "user", "content": "I need a financial analysis of tech stocks." },
    { "role": "assistant", "content": "I can help with that. What specific metrics are you interested in?" }
  ],

  "missionId": "resume-mission-abc-123"
}
```

---

## Entry Points & Exports

+----------------------------+------------------------------------------+--------------------------------------------+
| Export                     | Source (planned)                          | Type                                       |
+----------------------------+------------------------------------------+--------------------------------------------+
| `SessionConfigSchema`      | `shared/schemas/session-config.ts`        | Zod validation schema                      |
| `SessionConfig`            | `shared/schemas/session-config.ts`        | TypeScript type (inferred from Zod)        |
| `HarnessOverrides`         | `core/agent/harness/types.ts`             | Partial harness parameters                 |
| `configValidator`          | `shared/schemas/session-config.ts`        | Schema parse + defaults                    |
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
| Mission schema (current)   | `app/api/missions/mission.schema.ts:9-56`| Partial session config (subset)             |
| Provider config dispatch   | `infrastructure/providers/factory.ts:15-27`| `fromConfig()` reads session provider config|
| Harness defaults           | `harness/nlah/constants.ts`              | MAX_ITERATIONS, COMPACTION_RATIO, etc.      |
| Stream transport           | `app/api/missions/stream.transport.ts`   | Packet serialization                        |
+----------------------------+------------------------------------------+---------------------------------------------+

===============================================================================
  (c) 2026 Echo - All Rights Reserved
===============================================================================
