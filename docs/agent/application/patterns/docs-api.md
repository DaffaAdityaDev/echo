================================================================================
  API Documentation Pattern — Scalar & OpenAPI
================================================================================
  Module    : API Documentation
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-23
================================================================================

## Overview

The agent uses a hand-authored OpenAPI 3.0 specification (`openapi.json`) that
is served at runtime by Hono via the `@scalar/hono-api-reference` middleware.
Unlike the backend (which generates the spec from Go annotations), the agent's
spec is maintained manually — this is appropriate because the agent has only 6
endpoints and its schemas are well-defined by existing Zod validation schemas.

## File Structure

```
agent/
├── api/
│   └── openapi.json           ← Hand-authored OpenAPI 3.0 spec
└── src/
    └── app/
        └── api/
            ├── docs/
            │   └── docs.ts    ← Scalar reference handler
            └── routes.ts      ← Mounts docsRouter at /docs
```

## How It Works

```
  src/app/api/docs/docs.ts
    │
    │  import openApiSpec from "../../../../api/openapi.json"
    │  import { apiReference } from "@scalar/hono-api-reference"
    │
    │  docsRouter.get("/", apiReference({
    │    spec: { content: openApiSpec },
    │    theme: "purple",
    │  }))
    │
    ▼
  routes.ts: router.route("/docs", docsRouter)
    │
    ▼
  Hono serves Scalar UI at GET /docs
```

The `@scalar/hono-api-reference` middleware renders the full Scalar API
Reference UI (interactive, searchable, with code samples) directly from the
imported JSON spec.

## Spec Structure (`openapi.json`)

The spec covers all 6 agent endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| POST | `/api/generate-mission` | Execute agent mission (SSE stream) |
| GET | `/api/models` | List available LLM models |
| GET | `/api/features` | List agent features/tools |
| GET | `/api/skills` | List agent skill definitions |
| POST | `/api/internal/sessions/summarize` | Summarize session history |

### Key Schemas Documented

- `ProviderConfig` — LLM provider settings (type, base_url, api_key, model)
- `MissionRequest` — Full request body for generate-mission with all nested
  config objects (memory, harness, harnessConfig, mcpServers, restTools)
- `HarnessPacket` — All SSE event types and their payloads (18 event types)
- `AgentStatus` — Status object embedded in SSE heartbeats

### Security Schemes

- `BearerAuth` — HTTP Bearer JWT (used by most endpoints)
- `InternalTokenAuth` — X-Internal-Token header (used by internal endpoints)

## Adding a New Endpoint

1. Add the route and handler in the appropriate module under `src/app/api/`.
2. Add the corresponding path, method, request body, and response schema to
   `agent/api/openapi.json`.
3. If the endpoint uses new types, add them under `components/schemas`.
4. Restart the agent service to pick up the updated spec.

The spec is imported at build time via Bun's native JSON import:
```typescript
import openApiSpec from "../../../../api/openapi.json" with { type: "json" };
```
Changes to `openapi.json` take effect on the next `bun start` or container
restart — no build step is required for the spec itself.

## Keeping Spec in Sync

Since the spec is manual, follow these rules to prevent drift:

- **Request bodies**: Match the Zod schema exactly. The Zod schemas in
  `mission.schema.ts`, `summarize.ts`, etc. are the source of truth.
- **Response shapes**: Verify against actual handler return values in
  `mission.controller.ts`, `model.controller.ts`, etc.
- **Auth requirements**: Every endpoint that goes through `authMiddleware`
  should have a `security` block referencing `BearerAuth`.
- **SSE events**: When new packet types are added to `shared/types/index.ts`,
  add them to the spec's `HarnessPacket` schema and the endpoint description.

## Differences from Backend Approach

| Aspect | Backend (Go/Fiber) | Agent (Hono/Bun) |
|--------|-------------------|------------------|
| Spec format | OpenAPI 2.0 (Swagger) | OpenAPI 3.0 |
| Generation | Auto from Go annotations | Manual |
| Renderer | Scalar CDN via `<script>` tag | `@scalar/hono-api-reference` npm package |
| Route | `/api/docs` | `/docs` |
| Build step | `swag init` (Docker swagger-gen stage) | None (JSON imported at runtime) |

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
