================================================================================
  Features - Dynamic Feature Discovery Endpoint
================================================================================
  Module    : Feature Discovery
  Service   : agent
  Version   : 1.2
  Updated   : 2026-08-04
===============================================================================

## Description

Dynamic feature discovery endpoint that exposes the agent's **implemented
tool registry** to the Go backend: `[{id, name, description}]`, derived at
request time from the tool registry (`getImplementedFeatures()`). The agent is
NOT the catalog owner — it holds no tier or ui_schema metadata. The Go backend
owns the catalog (PostgreSQL `features` table, migration 009_create_features),
merges it with the agent's implemented set, enforces tier access, and returns
`locked` flags to end users.

> **IMPORTANT**: `GET /api/features` is an **INTERNAL** endpoint
> (agent-to-agent only). It is protected by the shared `X-Internal-Token`
> (see `auth.ts:6-40`, wired at `agent/src/index.ts:48`). End users MUST go
> through the backend at `GET /api/v1/features` —
> `backend/internal/handler/chat/handler.go:878-904`.

## Responsibility Split

+----------------+-------------------------------------------------------------+
| Owner          | Responsibility                                              |
+----------------+-------------------------------------------------------------+
| Agent (Hono)   | Implementation registry — serves `[{id, name, description}]`|
|                |   derived dynamically from the tool registry via            |
|                |   `getImplementedFeatures()` (registry.ts). Holds no tier/  |
|                |   ui_schema in code and no user credentials or              |
|                |   entitlements.                                             |
| Backend (Go)   | Catalog owner + access authority — owns feature metadata in |
|                |   the PostgreSQL `features` table (migration               |
|                |   009_create_features), proxies the effective catalog via   |
|                |   `GetFeatures` with a 10-minute Redis cache                |
|                |   (`agent:features`), enforces the user tier, and maps the  |
|                |   catalog to `FeatureResponse` with `locked` flags for end  |
|                |   users.                                                    |
+----------------+-------------------------------------------------------------+

## Backend Consumption Flow

The backend never exposes the raw agent registry to clients. It merges its DB
catalog with the agent's implemented set — the effective catalog is **DB
features ∩ agent implemented registry**. Two paths consume `GET /api/features`:

```
  GET /api/features            (agent, internal — X-Internal-Token)
       │
       ▼
  GetFeatures(ctx)             backend/internal/handler/chat/handler.go:751-799
       │  1. Redis GET "agent:features"  (TTL 10m)
       │  2. cache hit      -> return []Feature immediately
       │  3. cache miss     -> GET {HonoAPIURL}/api/features
       │                       header: X-Internal-Token
       │  4. unmarshal []ImplementedFeature{id,name,description}
       │     merge with DB features table (tier_requirement,
       │     ui_schema, status from 009_create_features)
       │     Redis SET 10m, return
       │
       ├──► HandleGetFeatures        handler.go:878-904
       │      GET /api/v1/features   (end-user route)
       │      -> []FeatureResponse{ id, name, description, locked }
       │         locked = (userTier=="free" && tier_requirement=="pro")
       │
       └──► HandleChat (tier gate)   handler.go:180-195
              for each requested feature ID:
              free tier + pro requirement -> 403
              "Feature 'X' requires a Pro subscription."
```

Cache key `agent:features`, TTL **10 minutes**. On agent outage the backend
returns a 500 from `GetFeatures`; the cache softens this window.

### FeatureResponse `locked` Contract

```typescript
// backend/internal/handler/chat/handler.go:115-120
interface FeatureResponse {
  id: string;
  name: string;
  description: string;
  locked: boolean;   // true when free-tier user requests a pro-tier feature
}
```

Semantics:

+----------+---------------------------------------------------------------+
| `locked` | Meaning                                                       |
+----------+---------------------------------------------------------------+
| false    | Feature available to this user — may be requested in chat     |
|          |   payload features[]                                           |
| true     | Feature exists but requires Pro — request would be rejected   |
|          |   403 by the tier gate (handler.go:180-195)                    |
+----------+---------------------------------------------------------------+

`tier_requirement` lives in the backend `features` table and is intentionally
NOT exposed to end users nor held by the agent.

---

## File Structure

```
features/
  features.routes.ts   # Route definition (single GET)
```

---

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         HTTP GET /features                            │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       features.routes.ts:6-8                          │
│              return c.json(getImplementedFeatures())                  │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
          ┌─────────────────────────────────────────────────────┐
          │  getImplementedFeatures() (registry.ts)             │
          │  LAZY_TOOLS keys enriched by                        │
          │  toolRegistry.getAllTools()                         │
          │  → sorted, deduplicated by id                       │
          │  [                                                  │
          │    { id, name, description }                        │
          │  ]                                                  │
          └─────────────────────────────────────────────────────┘
```

Auth: requests to this route are validated by `authMiddleware`
(`middleware/auth.ts`) — `X-Internal-Token` or `Authorization: Bearer`
compared against `ENV.INTERNAL_AUTH_TOKEN`; failure returns 403.

---

## Entry Points & Exports

+---------------------+-------------------------+-------------------+
| Export              | Source                  | Type              |
+---------------------+-------------------------+-------------------+
| `featuresRouter`    | `features.routes.ts`    | `Hono` router     |
| `getImplementedFeatures()` | `core/agent/tools/registry.ts` | `ImplementedFeature[]` |
+---------------------+-------------------------+-------------------+

---

## Dependencies

+-------------------+-----------------------------------------------------------+
| Dependency        | Purpose                                                   |
+-------------------+-----------------------------------------------------------+
| `hono`            | HTTP framework                                            |
| `getImplementedFeatures()` | Implemented tool registry (core/agent/tools/registry.ts)  |
| `authMiddleware`  | X-Internal-Token validation (`middleware/auth.ts`)         |
| Go `GetFeatures`  | Consumer — proxy + Redis cache (`chat/handler.go:751-799`) |
+-------------------+-----------------------------------------------------------+

---

## Source References

+--------------------+-----------------------------+----------------------------------------------+
| Ref                | File                        | Key Lines                                    |
+--------------------+-----------------------------+----------------------------------------------+
| Route              | `features.routes.ts:6-8`    | `router.get("/features", ...)` returns       |
|                    |                             |   implemented registry                       |
| Implemented registry| `registry.ts:20-42`        | getImplementedFeatures() — dynamic from      |
|                    |                             |   LAZY_TOOLS + getAllTools()                 |
| Lazy tool map      | `registry.ts:14-18`         | LAZY_TOOLS: featureId -> lazy import         |
| Tool resolution    | `registry.ts:125-160`       | resolveTools(features)                       |
| Unknown feature    | `mission.controller.ts:96-106` | 400 `{"error": "Unknown feature '<id>'"}`   |
| Auth middleware    | `middleware/auth.ts:8-42`   | X-Internal-Token vs INTERNAL_AUTH_TOKEN      |
| Route wiring       | `api/routes.ts:14`          | `router.route("/", featuresRouter)`          |
| App wiring         | `index.ts:48,52`            | auth on /api/*, routes at /api               |
| Backend catalog    | `backend/migrations/009_    | features table (tier_requirement, ui_schema, |
|                    |   create_features.up.sql`   |   status)                                    |
| Backend proxy      | `chat/handler.go:751-799`   | GetFeatures — Redis cache 10m, merge + proxy |
| Backend response   | `chat/handler.go:878-904`   | HandleGetFeatures — FeatureResponse locked   |
| Backend tier gate  | `chat/handler.go:180-195`   | 403 when free tier requests pro feature      |
+--------------------+-----------------------------+----------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
