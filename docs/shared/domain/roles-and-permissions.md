================================================================================
  ROLES & PERMISSIONS
================================================================================
  Module    : Roles & Permissions
  Service   : Shared / Domain
  Version   : 1.2
  Updated   : 2026-08-04
================================================================================

## Description

RBAC model for Echo — user roles, tier-based access control, feature gates, and
planned rate limiting tiers. Currently in early implementation with basic tier
checking in the chat handler.

Echo gates features by **tier** (not role); the `role` field on the User struct
is reserved for planned admin functionality. Two services cooperate:

### Responsibility Split

+----------------+-------------------------------------------------------------+
| Owner          | Responsibility                                              |
+----------------+-------------------------------------------------------------+
| Agent (Hono)   | Implementation registry — serves the **implemented tool      |
|                |   registry** (agent/src/core/agent/tools/registry.ts,        |
|                |   `getImplementedFeatures()`) via internal GET /api/v1/features |
|                |   (features.routes.ts:6-8): `[{id, name, description}]`,     |
|                |   dynamically derived from the tool registry. Holds NO       |
|                |   catalog metadata (tier/ui_schema) in code and no user      |
|                |   credentials or entitlements.                               |
| Backend (Go)   | Catalog owner + access authority — owns feature metadata in  |
|                |   the PostgreSQL `features` table (migration                |
|                |   009_create_features), enforces the user tier               |
|                |   (chat/handler.go:180-195), proxies the catalog through a   |
|                |   10-minute Redis cache (chat/handler.go:751-799), and       |
|                |   returns `locked` flags to clients                          |
|                |   (chat/handler.go:878-904).                                 |
+----------------+-------------------------------------------------------------+

## File Structure

+------------------------------------+--------------------------------------------+
| Location                           | Role                                       |
+------------------------------------+--------------------------------------------+
| backend/internal/handler/          |                                            |
|   chat/handler.go                  | Tier check, feature response, caching      |
| backend/internal/constants/auth/   |                                            |
|   jwt.go                           | Auth constants                             |
| agent/src/core/agent/tools/        |                                            |
|   registry.ts                      | LAZY_TOOLS map, getImplementedFeatures()   |
|                                    |   (implementation registry — no catalog    |
|                                    |   metadata)                                |
| agent/src/adapter/inbound/api/     |                                            |
|   features/features.routes.ts      | Internal GET /api/v1/features endpoint        |
| agent/src/adapter/inbound/api/     |                                            |
|   missions/mission.constants.ts    | Mission defaults (strategy, tenant/user/   |
|                                    |   org) — NOT feature constants             |
| frontend/web/src/features/shared/  |                                            |
|   hooks/useFeatures.ts             | Client-side feature discovery hook         |
| frontend/web/src/lib/api-client.ts | API client                                 |
+------------------------------------+--------------------------------------------+

## Role Model

### Planned Roles

+------+----------------------------+---------------------------------------+
| Role | Description                | Scope                                 |
+------+----------------------------+---------------------------------------+
| user | Standard authenticated     | Self-service (own data only)          |
|      |   user                     |                                       |
| admin| System administrator       | Aggregate data, user management       |
+------+----------------------------+---------------------------------------+

### Current Implementation

The `User` struct includes a `role` field but it is not actively enforced
beyond planned admin aggregate views. It lives in
`backend/internal/models/auth/user.go:5-13`:

```go
type User struct {
    ID           int       `json:"id"`
    Email        string    `json:"email"`
    PasswordHash string    `json:"-"`
    Name         string    `json:"name"`
    Role         string    `json:"role"`
    CreatedAt    time.Time `json:"created_at"`
    UpdatedAt    time.Time `json:"updated_at"`
}
```

## Tier System

Echo uses a **tier-based** access model (not role-based) for feature gating.
The tier is read from the signed JWT `tier` claim (issued at login/
registration); missing or unknown values default to `free`.

### Tiers

+------+-----------------+-------------------------------------+
| Tier | Description     | Feature Access                      |
+------+-----------------+-------------------------------------+
| free | Free tier       | Basic features only                 |
| pro  | Pro subscriber  | All features                        |
+------+-----------------+-------------------------------------+

### Default Behavior

```go
// backend/internal/middleware/claims.go — TierFromClaims
userTier := middleware.UserTier(c)
// Tier comes from the signed JWT "tier" claim (issued at login/registration);
// missing or unknown claims resolve to "free" (least privilege).
```

## Feature Gates

### Feature Catalog Schema (Backend-Owned)

Catalog metadata lives in the backend PostgreSQL `features` table — created by
migration `009_create_features` (`backend/migrations/009_create_features.up.sql`):

```sql
CREATE TABLE IF NOT EXISTS features (
  id VARCHAR(128) PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tier_requirement TEXT NOT NULL DEFAULT 'free' CHECK (tier_requirement IN ('free', 'pro')),
  ui_schema JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

The agent does NOT hold `tier_requirement` or `ui_schema` anywhere in code.
Its only feature surface is the implemented registry:

```typescript
// agent/src/core/agent/tools/registry.ts — getImplementedFeatures()
interface ImplementedFeature {
  id: string;          // requestable feature id (LAZY_TOOLS key)
  name: string;        // loaded tool definition name (fallback: id)
  description: string; // loaded tool definition description
}
```

### Current Implemented Registry (agent-side)

The Hono Agent derives the implemented registry dynamically from its tool
registry via `getImplementedFeatures()` in
`agent/src/core/agent/tools/registry.ts` — the LAZY_TOOLS keys enriched by the
autoloaded tool definitions, deduplicated by id, sorted by id:

+-----------------+----------------------------------+--------------------+
| Feature ID      | Tool Definition (name)           | Tier Requirement   |
+-----------------+----------------------------------+--------------------+
| delegate_task   | delegate_task                    | pro (backend DB)   |
| web_search      | web_search                       | free (backend DB)  |
| write_todos     | write_todos                      | free (backend DB)  |
+-----------------+----------------------------------+--------------------+

Served internally at `GET /api/v1/features` as `[{id, name, description}]`
(`agent/src/adapter/inbound/api/v1/features/features.routes.ts:6-8`). The Go
gateway merges this with its DB catalog (the effective set is **DB catalog ∩
agent implemented set**) and proxies into Redis under key `agent:features`
with a 10-minute TTL.

### Tier Enforcement Flow

```
1. Go Gateway receives request with Features[] from client
2. Go fetches the effective feature catalog (cached in Redis, TTL 10m).
   Source: DB `features` table ∩ agent implemented registry
   (GET /api/v1/features). A feature unknown to the agent is rejected
   with 400 "Unknown feature '<id>'".
3. For each requested feature:
   IF user tier == "free" AND feature.tier_requirement == "pro"
     -> REJECT with 403: "Feature 'X' requires a Pro subscription."
4. If all pass, forward to Agent with Features[]
```

### Code Implementation

```go
// backend/internal/handler/chat/handler.go:180-195
if len(req.Features) > 0 {
    featuresCatalog, err := h.GetFeatures(ctx)
    if err == nil {
        catalogMap := make(map[string]Feature)
        for _, f := range featuresCatalog {
            catalogMap[f.ID] = f
        }
        for _, fID := range req.Features {
            if feat, exists := catalogMap[fID]; exists {
                if userTier == "free" && feat.TierRequirement == "pro" {
                    return handlerutil.RespondError(c, fiber.StatusForbidden,
                        fmt.Sprintf("Feature '%s' requires a Pro subscription.", feat.Name))
                }
            }
        }
    }
}
```

### Feature Response (Client-Facing)

```typescript
// backend/internal/handler/chat/handler.go:115-120 — FeatureResponse
interface FeatureResponse {
  id: string;
  name: string;
  description: string;
  locked: boolean;    // true if free user requesting pro feature
}
```

Produced by `HandleGetFeatures` (handler.go:878-904): `locked = true` when
`userTier == "free"` and `TierRequirement == "pro"`. End users receive this
shape from `GET /api/v1/features` — never the internal `tier_requirement`
field.

## Feature Discovery

```
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   FRONTEND   │   │   GO BACKEND     │   │     REDIS        │   │     AGENT        │
└──────┬───────┘   └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
       │                    │                       │                     │
       │  GET /features     │                       │                     │
       │  JWT tier: free    │                       │                     │
       │───────────────────►│                       │                     │
       │                    │                       │                     │
       │                    │  Check cache           │                     │
       │                    │  "agent:features"      │                     │
       │                    │──────────────────────►│                     │
       │                    │                       │                     │
       │                    │◄── MISS ──────────────│                     │
       │                    │                       │                     │
       │                    │  GET /api/v1/features     │                     │
       │                    │────────────────────────────────────────────►│
       │                    │                       │                     │
       │                    │◄── feature[] ───────────────────────────────│
       │                    │                       │                     │
       │                    │  Set cache (10m TTL)  │                     │
       │                    │──────────────────────►│                     │
       │                    │                       │                     │
       │                    │  Filter by tier:      │                     │
       │                    │  if free -> locked:   │                     │
       │                    │    true for pro feats │                     │
       │                    │                       │                     │
       │  [ { id, locked:   │                       │                     │
       │     false/true } ] │                       │                     │
       │◄───────────────────│                       │                     │
```

## Rate Limiting Tiers (Planned — Not Implemented)

> **Status**: this table is a design sketch only. No rate limiting is
> implemented anywhere in the current codebase.

+------+----------+-------------------+-----------------+---------------+
| Tier | Chat RPM | Mission Gen / min | Features / min  | Models / min  |
+------+----------+-------------------+-----------------+---------------+
| free | 10       | 5                 | 30              | 30            |
| pro  | 60       | 30                | 120             | 120           |
| admin| 200      | 100               | unlimited       | unlimited     |
+------+----------+-------------------+-----------------+---------------+

## Internal Service Auth

Go -> Agent communication uses a shared `INTERNAL_AUTH_TOKEN` — not tied to
tiers or roles. This is a static pre-shared key:

```env
INTERNAL_AUTH_TOKEN=default-internal-token-secret
```

The agent enforces it on all `/api/*` routes except `/docs`
(`agent/src/adapter/inbound/middleware/auth.ts:8-42`, wired in
`agent/src/index.ts:48`).

## Feature Constants

```typescript
// agent/src/core/agent/tools/registry.ts — getImplementedFeatures()
// The agent does NOT maintain tier requirements. It reports only what it can
// execute (id, name, description). Tier gating is applied by the backend
// against its `features` table:
// - feature.tier_requirement == "free" -> available to all
// - feature.tier_requirement == "pro" -> free users see locked: true
```

Note: `agent/src/adapter/inbound/api/missions/mission.constants.ts` exists but
holds mission defaults (strategies, tenant/user/org id defaults, validation
messages) — NOT feature constants. Catalog metadata lives exclusively in the
backend `features` table (migration 009_create_features); the agent's
`registry.ts` holds only the implemented tool registry.

## Entry Points & Exports

- **Tier check**: `backend/internal/middleware/claims.go` —
  TierFromClaims (signed JWT `tier` claim; missing/unknown → `free`) + enforcement loop
- **Feature response**: `backend/internal/handler/chat/handler.go:878-904` —
  HandleGetFeatures (locked flags)
- **Feature cache**: `backend/internal/handler/chat/handler.go:751-799` —
  GetFeatures with Redis TTL 10m
- **Feature catalog**: backend PostgreSQL `features` table (migration
  009_create_features) — tier_requirement, ui_schema, status
- **Implemented registry**: `agent/src/core/agent/tools/registry.ts` —
  getImplementedFeatures() (dynamic from tool registry)
- **Internal endpoint**:
  `agent/src/adapter/inbound/api/v1/features/features.routes.ts:6-8`
- **Frontend feature discovery**:
  `frontend/web/src/features/shared/hooks/useFeatures.ts`
- **User role field**: `backend/internal/models/auth/user.go:5-13`

## Source References

+-------------------------------------------------------+-------+----------------------------------------+
| File                                                  | Lines | Role                                   |
+-------------------------------------------------------+-------+----------------------------------------+
| backend/internal/handler/chat/handler.go              | 180-  | Tier validation loop                   |
|                                                       | 195   |                                        |
| backend/internal/handler/chat/handler.go              | 108-  | Feature struct with tier_requirement   |
|                                                       | 113   |                                        |
| backend/internal/handler/chat/handler.go              | 878-  | HandleGetFeatures with tier filtering  |
|                                                       | 904   |  (locked)                              |
| backend/internal/handler/chat/handler.go              | 751-  | GetFeatures with Redis caching         |
|                                                       | 799   |                                        |
| backend/migrations/009_create_features.up.sql         | 1-16  | features table DDL + seed data         |
| agent/src/core/agent/tools/registry.ts                | 20-42 | getImplementedFeatures() — implemented |
|                                                       |       |   registry (agent-side, no metadata)   |
| agent/src/adapter/inbound/api/v1/features/               | 6-8   | Internal GET /api/v1/features             |
|   features.routes.ts                                 |       |                                        |
| agent/src/adapter/inbound/api/missions/               | 87-97 | Unknown feature -> 400 validation      |
|   mission.controller.ts                              |       |                                        |
| backend/internal/models/auth/user.go                  | 5-13  | User struct with role field            |
| frontend/web/src/features/shared/hooks/useFeatures.ts | 1-28  | Client-side feature discovery hook     |
+-------------------------------------------------------+-------+----------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
