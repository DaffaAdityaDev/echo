================================================================================
  API Routes - Hono REST API Route Structure
================================================================================
  Module    : API Routes
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

The API layer is built on the Hono framework with a modular route aggregator
pattern. All routes are mounted under the `/api` prefix with global middleware
for CORS, monitoring, and authentication.

---

## File Structure

```
src/app/
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
│  ┌─ /api/features           ──→  Returns ACTIVE_FEATURES catalog        │
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
| `default router`                 | `api/routes.ts`                     | Hono router mounting mission, model, feature subs|
| `missionRouter`                  | `missions/mission.routes.ts`        | `POST /generate-mission` handler                 |
| `modelRouter`                    | `models/model.routes.ts`            | `GET /models` handler                            |
| `featuresRouter`                 | `features/features.routes.ts`       | `GET /features` handler                          |
| `missionController`              | `missions/mission.controller.ts`    | `MissionController` instance                     |
| `modelController`                | `models/model.controller.ts`        | `ModelController` instance                       |
| `HttpStreamTransport`            | `missions/stream.transport.ts`      | SSE packet serializer with sequence numbers      |
| `createMissionSchema`            | `missions/mission.schema.ts`        | Zod schema for mission payload validation        |
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
  tier_requirement: 'free' | 'pro';
  ui_schema: { render_type: string; icon: string; primary_color: string };
}>
```

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
| `src/app/api/routes.ts`          | 1-12                        | Route aggregator, sub-router mounting             |
| `missions/mission.routes.ts`     | 7                           | `POST /generate-mission`                          |
| `missions/mission.controller.ts` | 20-121                      | Mission creation orchestration (uses adapters)    |
| `adapter/factory.ts`            | 1-50                        | AdapterFactory.create() for LLM/backend           |
| `adapter/manager.ts`            | 1-80                        | ConnectionManager lifecycle                       |
| `missions/mission.schema.ts`     | 9-61                        | Zod input schema with strategy aliasing           |
| `missions/stream.transport.ts`   | 7-26                        | SSE transport with seq/timestamp                  |
| `models/model.routes.ts`         | 6                           | `GET /models`                                     |
| `features/features.routes.ts`    | 6                           | `GET /features`                                   |
| `middleware/auth.ts`             | 6-32                        | Bearer / X-Internal-Token auth                    |
| `middleware/error.ts`            | 7-58                        | Classified error handler                          |
| `middleware/monitor.ts`          | 5-56                        | Request/response logging                          |
+----------------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
