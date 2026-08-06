================================================================================
  API Routes - Hono REST API Route Structure
================================================================================
  Module    : API Routes
  Service   : agent
  Version   : 1.4
  Updated   : 2026-08-05 (prompt_template added; Feature Pod Convention applied)
================================================================================

## Description

The API layer is built on the Hono framework with a modular route aggregator
pattern. All routes are mounted under the `/api` prefix with global middleware
for CORS, monitoring, and authentication.

Every feature pod under `api/<feature>/` follows the Feature Pod Convention
(routes / controller / schema / optional constants) — see
[`docs/agent/application/patterns/code-conventions/api-pod-convention.md`](../application/patterns/code-conventions/api-pod-convention.md).

---

## File Structure

```
src/adapter/inbound/
  api/
    routes.ts                     # Route aggregator
    missions/
      mission.routes.ts           # POST /generate-mission, /v1/missions/:id/approve|deny|stream
      mission.controller.ts       # handler functions: createMission, handleHitlDecision, streamMissionLogs
      mission.schema.ts           # Zod input validation
      mission.constants.ts        # Route paths & messages
      mission-stream.ts           # Redis-backed mission event store (recordEvent, getHistory, subscribe)
      stream.transport.ts         # SSE packet serialization
    models/
      model.routes.ts             # GET /models
      model.controller.ts         # listModels
      model.schema.ts             # Response schema
      model.constants.ts          # API paths & messages
    features/
      features.routes.ts          # GET /features
      features.controller.ts      # getFeatures
      features.schema.ts          # Response schema
    skills/
      skills.routes.ts            # GET /skills
      skills.controller.ts        # listSkills
      skills.schema.ts            # Response schema
    strategies/
      strategies.routes.ts        # GET /strategies
      strategies.controller.ts    # listStrategies
      strategies.schema.ts        # Response schema
    internal/
      internal.routes.ts          # POST /internal/sessions/summarize, POST /internal/tokenize
      internal.controller.ts      # summarizeSession
      internal.schema.ts          # Summarize request/response schemas
      tokenize.controller.ts      # tokenize — BPE token count (official tiktoken WASM)
    core/tokens/
      tokenizer.ts                # countTokens() — o200k_base encoding singleton
    docs/
      docs.ts                     # Scalar API reference (infra, not a pod)

  middleware/
    auth.ts                       # Bearer/X-Internal-Token auth
    error.ts                      # Centralized error handler
    monitor.ts                    # Request/response logging
```

---

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Client Request                                   │
└────────────────────────────────┬─────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          Hono App (index.ts)                              │
│                                                                           │
│  ┌─ CORS (global, *)                                                     │
│  ┌─ Monitor Middleware (global, *) — logs method/path/body/duration      │
│  ┌─ Auth Middleware (/api/*) — validates Bearer or X-Internal-Token      │
└────────────────────────────────┬─────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   Route Aggregator (routes.ts)                            │
│                                                                           │
│  ┌─ /api/generate-mission  ──→  createMission                            │
│  │                            ├─ Zod schema validation                   │
│  │                            ├─ ProviderFactory.fromConfig (provider)   │
│  │                            ├─ strategyRegistry.resolve(strategyKey)   │
│  │                            ├─ toolRegistry.resolveTools(features)     │
│  │                            ├─ NlahHarness.runMission(state, onPacket) │
│  │                            └─ SSE stream (HttpStreamTransport)        │
│  │                                                                        │
│  ┌─ /api/v1/missions/:id/stream    ──→  streamMissionLogs                │
│  │                            └─ SSE replay of recorded mission packets  │
│  │                                                                        │
│  ┌─ /api/v1/missions/:id/approve   ──→  handleHitlDecision (approve)     │
│  ┌─ /api/v1/missions/:id/deny      ──→  handleHitlDecision (deny)        │
│  │                                                                        │
│  ┌─ /api/models             ──→  listModels                             │
│  │                            └─ Proxy to LLM provider /v1/models       │
│  │                                                                        │
│  ┌─ /api/features           ──→  Returns implemented tool registry       │
│  │                                                                        │
│  ┌─ /api/strategies         ──→  StrategyRegistry catalog [Active]       │
│  │                            └─ name, versions, status, aliases         │
└────────────────────────────────┬─────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    Error Handler (onError)                                │
│                                                                           │
│  ┌─ AppError         → 4xx with context                                  │
│  ┌─ Rate Limit       → 429                                                │
│  ┌─ Timeout          → 504                                                │
│  ┌─ SyntaxError/JSON → 400                                                │
│  └─ Unhandled        → 500                                                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Entry Points & Exports

+----------------------------------+--------------------------------------+--------------------------------------------------+
| Export                           | Source                               | Description                                      |
+----------------------------------+--------------------------------------+--------------------------------------------------+
| `default router`                 | `adapter/inbound/api/routes.ts`                     | Hono router mounting mission, model, feature, skill, strategy, internal, docs sub-routers |
| `missionRouter`                  | `adapter/inbound/api/missions/mission.routes.ts`        | `POST /generate-mission` + `/v1/missions/:id/approve|deny|stream` handlers |
| `modelRouter`                    | `adapter/inbound/api/models/model.routes.ts`            | `GET /models` handler                            |
| `featuresRouter`                 | `adapter/inbound/api/features/features.routes.ts`       | `GET /features` handler                          |
| `skillsRouter`                   | `adapter/inbound/api/skills/skills.routes.ts`           | `GET /skills` handler                            |
| `strategiesRouter`               | `adapter/inbound/api/strategies/strategies.routes.ts`   | `GET /strategies` handler                        |
| `internalRouter`                 | `adapter/inbound/api/internal/internal.routes.ts`       | `POST /sessions/summarize` handler               |

| `createMission`                  | `adapter/inbound/api/missions/mission.controller.ts`    | Module-level handler function                    |
| `handleHitlDecision`             | `adapter/inbound/api/missions/mission.controller.ts`    | Module-level handler function                    |
| `streamMissionLogs`              | `adapter/inbound/api/missions/mission.controller.ts`    | Module-level handler function                    |
| `listModels`                     | `adapter/inbound/api/models/model.controller.ts`        | Module-level handler function                    |
| `getFeatures`                    | `adapter/inbound/api/features/features.controller.ts`   | Module-level handler function                    |
| `listSkills`                     | `adapter/inbound/api/skills/skills.controller.ts`       | Module-level handler function                    |
| `listStrategies`                 | `adapter/inbound/api/strategies/strategies.controller.ts` | Module-level handler function                  |
| `summarizeSession`               | `adapter/inbound/api/internal/internal.controller.ts`   | Module-level handler function                    |
| `HttpStreamTransport`            | `adapter/inbound/api/missions/stream.transport.ts`      | SSE packet serializer with sequence numbers      |
| `createMissionSchema`            | `adapter/inbound/api/missions/mission.schema.ts`        | Zod schema for mission payload validation        |
| `hitlDecisionSchema`             | `adapter/inbound/api/missions/mission.schema.ts`        | Zod schema for HITL approve/deny payload         |
| `SummarizeRequestSchema`         | `adapter/inbound/api/internal/internal.schema.ts`       | Zod schema for summarize request validation      |
+----------------------------------+--------------------------------------+--------------------------------------------------+

### Mission Endpoint - POST /api/generate-mission

```
// Request body (after Zod normalization)
{
  prompt: string;
  strategy: 'standard' | 'agent';      // 'react'/'nlah'/'sequential' alias to 'agent'
  tenantId: string;
  userId: string;
  orgId: string;
  missionId?: string;
  model?: string;
  prompt_template?: string;    // behavior prompt template name; resolved from backend
                               // (PromptAdapter) — missing/unknown falls back to default behavior
  provider_config: {
    type: 'openai' | 'anthropic' | 'lm-studio' | 'opencode-go';
    base_url: string;
    api_key?: string;
    model: string;
  };
  features?: string[];
  skills?: string[];
  history?: Array<{ role: string; content: string }>;
  config?: AgentConfigSchema;          // memory, harness, mcpServers, restTools, ...
}

// Response: SSE stream of HarnessPacket events
// No controller-side heartbeat — the harness emits heartbeat packets every
// 5s during streaming; the mission-log stream endpoint uses a 15s
// `: heartbeat\n\n` comment interval.
```

### Mission Log Stream - GET /api/v1/missions/:id/stream  [Active]

Redis-backed replay + live tail of mission events (key `mission:events:{id}`,
`XADD`/`XRANGE`/`XREAD BLOCK`, MAXLEN ~2000, TTL 24h).

```
// Query
GET /api/v1/missions/:id/stream?after=<stream-id>
  after:      exclusive cursor (Redis stream ID). Omitted = replay full history.
  Header      `Last-Event-ID: <stream-id>` also accepted as cursor.

// Response 200 -> SSE. Each frame is a packet JSON enriched with `sid`
// (the Redis stream ID). Stream closes after a terminal packet
// (`mission_completed` or `error`).
data: {"type":"content","content":"...","sid":"1699...-0", ...}

// Errors
503 { "error": "Mission stream unavailable: Redis is offline" }
```

> If Redis is unavailable the endpoint returns 503 — the agent keeps serving
> chat; only stream replay/recovery is degraded. Events are recorded
> fire-and-forget: a Redis write failure never breaks the primary SSE stream.

### Models Endpoint - GET /api/models

```
// Response
{ models: Array<{ id: string; name: string }> }

// Proxies to ENV.LLM_MODEL_API_URL/v1/models
```

### Features Endpoint - GET /api/features

```
// Response
Array<{
  id: string;
  name: string;
  description: string;
}>
// Implemented tool registry — dynamically derived from the tool
// registry (getImplementedFeatures). No tier/ui_schema: catalog
// metadata is owned by the backend features table (009 migration).
```

### Strategies Endpoint - GET /api/strategies  [Active]


Strategy catalog source of truth — reads the versioned registry
(`core/agent/strategies/registry.ts`). Rollout % is NOT included here; it is
gateway-owned (settings table) and merged at `GET /api/v1/strategies`.

```
// Response 200
{
  "strategies": [
    {
      "name": "nlah",
      "versions": [
        { "version": "nlah:v1", "status": "active", "aliases": ["agent", "deep-research", "react", "sequential"] }
      ]
    }
  ]
}
```

Payload schema: `strategy_version` (`name:v1`) accepted on
`POST /generate-mission` — resolved by the gateway; the registry maps the
version back to its strategy implementation via `StrategyFactory`.

---

### Tokenize Endpoint - POST /api/internal/tokenize  [Active]

Internal (service-to-service, `X-Internal-Token` or service JWT). Counts
tokens with the official tiktoken BPE tokenizer (`o200k_base`, WASM via
`@dqbd/tiktoken`) — used by the Go backend for exact `messages.token_count`
on user messages and by the load-test seeder.

Request:
```json
{ "text": "Hello world" }
```

Response:
```json
{ "tokens": 2 }
```

Errors: `400` invalid body (missing `text`), `500` tokenization failure.

---

## Dependencies

+-----------------------+-------------+----------------------------------------------------+
| Dependency            | Version     | Usage                                              |
+-----------------------+-------------+----------------------------------------------------+
| `hono`                | ^4.12.18    | HTTP framework, router, streaming, middleware      |
| `@hono/node-server`   | ^2.0.1      | Node.js server adapter                             |
| `zod`                 | ^4.4.3      | Input schema validation                            |
| `@langchain/core`     | ^1.1.45     | BaseMessage types, HumanMessage                    |
| `node:crypto`         | built-in    | UUID generation                                    |
+-----------------------+-------------+----------------------------------------------------+

---

## Source References

+----------------------------------+-----------------------------+---------------------------------------------------+
| File                             | Line                        | Description                                       |
+----------------------------------+-----------------------------+---------------------------------------------------+
| `src/index.ts`                   | 57-59                       | Global middleware registration (CORS, monitor, auth) |
| `src/index.ts`                   | 67                          | `app.onError(errorHandler)`                       |
| `src/adapter/inbound/api/routes.ts` | 1-20                    | Route aggregator, sub-router mounting             |
| `adapter/inbound/api/missions/mission.routes.ts` | 7-10 | `POST /generate-mission`, `/v1/missions/:id/approve|deny|stream` |
| `adapter/inbound/api/missions/mission.controller.ts` | 36-201 | `createMission()` orchestrates flow         |
| `adapter/inbound/api/missions/mission.controller.ts` | 203-273 | `handleHitlDecision()` — approve/deny resume |
| `adapter/inbound/api/missions/mission.controller.ts` | 328-380 | `streamMissionLogs()` — SSE log replay   |
| `adapter/inbound/api/missions/mission.schema.ts` | 223-290 | Zod `createMissionSchema` (preprocess + validation) |
| `adapter/inbound/api/missions/mission.schema.ts` | 295-299 | Zod `hitlDecisionSchema`                  |
| `adapter/inbound/api/missions/mission.constants.ts` | 32-37 | `MISSION_ROUTES` path constants             |
| `adapter/inbound/api/missions/stream.transport.ts` | 8-29 | SSE transport with seq/timestamp                  |
| `adapter/inbound/api/models/model.routes.ts` | 6         | `GET /models`                                     |
| `adapter/inbound/api/features/features.routes.ts` | 6 | `GET /features`                                   |
| `adapter/inbound/middleware/auth.ts` | 8-42                   | Bearer / X-Internal-Token auth                    |
| `adapter/inbound/middleware/error.ts` | 8-73                   | Classified error handler                          |
| `adapter/inbound/middleware/monitor.ts` | 5-54                | Request/response logging                          |
+----------------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
