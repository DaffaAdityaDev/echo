================================================================================
  API Routes - Hono REST API Route Structure
================================================================================
  Module    : API Routes
  Service   : agent
  Version   : 1.1
  Updated   : 2026-07-31 (planned: GET /api/strategies catalog route)
================================================================================

## Description

The API layer is built on the Hono framework with a modular route aggregator
pattern. All routes are mounted under the `/api` prefix with global middleware
for CORS, monitoring, and authentication.

---

## File Structure

```
src/adapter/inbound/
  api/
    routes.ts                     # Route aggregator
    missions/
      mission.routes.ts           # POST /generate-mission
      mission.controller.ts       # MissionController
      mission.schema.ts           # Zod input validation
      mission.constants.ts        # Route paths & messages
      stream.transport.ts         # SSE packet serialization
    models/
      model.routes.ts             # GET /models
      model.controller.ts         # ModelController
      model.constants.ts          # API paths & messages
    features/
      features.routes.ts          # GET /features
    strategies/
      strategies.routes.ts        # GET /strategies  [Active]

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
│  ┌─ /api/generate-mission  ──→  MissionController.createMission          │
│  │                            ├─ Zod schema validation                   │
│  │                            ├─ AdapterFactory.create (via              │
│  │                            │    ConnectionManager — llm, backend)     │
│  │                            ├─ StrategyFactory.create                  │
│  │                            ├─ ToolRegistry.resolveTools              │
│  │                            ├─ AgentHarness.runMission                │
│  │                            │  (harness uses adapters via interfaces)  │
│  │                            ├─ ConnectionManager.disconnectAll()       │
│  │                            └─ SSE stream (HttpStreamTransport)        │
│  │                                                                        │
│  ┌─ /api/models             ──→  ModelController.listModels             │
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
| `default router`                 | `adapter/inbound/api/routes.ts`                     | Hono router mounting mission, model, feature subs|
| `missionRouter`                  | `adapter/inbound/api/missions/mission.routes.ts`        | `POST /generate-mission` handler                 |
| `modelRouter`                    | `adapter/inbound/api/models/model.routes.ts`            | `GET /models` handler                            |
| `featuresRouter`                 | `adapter/inbound/api/features/features.routes.ts`       | `GET /features` handler                          |
| `strategiesRouter`               | `adapter/inbound/api/strategies/strategies.routes.ts`   | `GET /strategies` handler [Active]               |

| `missionController`              | `adapter/inbound/api/missions/mission.controller.ts`    | `MissionController` instance                     |
| `modelController`                | `adapter/inbound/api/models/model.controller.ts`        | `ModelController` instance                       |
| `HttpStreamTransport`            | `adapter/inbound/api/missions/stream.transport.ts`      | SSE packet serializer with sequence numbers      |
| `createMissionSchema`            | `adapter/inbound/api/missions/mission.schema.ts`        | Zod schema for mission payload validation        |
+----------------------------------+--------------------------------------+--------------------------------------------------+

### Mission Endpoint - POST /api/generate-mission

```
// Request body (after Zod normalization)
{
  prompt: string;
  strategy: 'react' | 'nlah' | 'standard' | 'sequential';
  tenantId: string;
  userId: string;
  orgId: string;
  missionId?: string;
  model?: string;
  provider_config: {
    type: 'openai' | 'anthropic' | 'lm-studio' | 'opencode-go';
    base_url: string;
    api_key?: string;
    model: string;
  };
  features?: string[];
  history?: Array<{ role: string; content: string }>;
}

// Response: SSE stream of HarnessPacket events
// Heartbeat ping every 15s
```

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
| `src/index.ts`                   | 29-35                       | Global middleware registration (CORS, monitor)    |
| `src/index.ts`                   | 38                          | `app.onError(errorHandler)`                       |
| `src/adapter/inbound/api/routes.ts` | 1-12                    | Route aggregator, sub-router mounting             |
| `adapter/inbound/api/missions/mission.routes.ts` | 7       | `POST /generate-mission`                          |
| `adapter/inbound/api/missions/mission.controller.ts` | 20-121 | Mission creation orchestration (uses adapters)    |
| `adapter/factory.ts`            | 1-50                        | AdapterFactory.create() for LLM/backend           |
| `adapter/manager.ts`            | 1-80                        | ConnectionManager lifecycle                       |
| `adapter/inbound/api/missions/mission.schema.ts` | 9-61 | Zod input schema with strategy aliasing           |
| `adapter/inbound/api/missions/stream.transport.ts` | 7-26 | SSE transport with seq/timestamp                  |
| `adapter/inbound/api/models/model.routes.ts` | 6         | `GET /models`                                     |
| `adapter/inbound/api/features/features.routes.ts` | 6 | `GET /features`                                   |
| `adapter/inbound/middleware/auth.ts` | 6-32                   | Bearer / X-Internal-Token auth                    |
| `adapter/inbound/middleware/error.ts` | 7-58                   | Classified error handler                          |
| `adapter/inbound/middleware/monitor.ts` | 5-56                | Request/response logging                          |
+----------------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
