================================================================================
  ROLES & PERMISSIONS
================================================================================
  Module    : Roles & Permissions
  Service   : Shared / Domain
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

RBAC model for Echo — user roles, tier-based access control, feature gates, and
planned rate limiting tiers. Currently in early implementation with basic tier
checking in the chat handler.

## File Structure

+------------------------------------+--------------------------------------------+
| Location                           | Role                                       |
+------------------------------------+--------------------------------------------+
| backend/internal/handler/          |                                            |
|   chat_handler.go                  | Tier check, feature response, caching      |
| backend/internal/constants/auth/   |                                            |
|   jwt.go                           | Auth constants                             |
| agent/src/app/api/missions/        |                                            |
|   mission.constants.ts             | Feature constants (implied)                |
| frontend/web/src/features/chat/    |                                            |
|   api/useFeatures.ts               | Client-side feature discovery hook         |
| frontend/web/src/lib/api-client.ts | API client                                 |
+------------------------------------+--------------------------------------------+

## Role Model

### Planned Roles

+------+----------------------------+---------------------------------------+
| Role | Description                | Scope                                 |
+------+----------------------------+---------------------------------------+
| user | Standard authenticated     | Self-service (own data only)          |
|      |   user                     |                                       |
| admin| System administrator       | Aggregate data, user management,      |
|      |                            |   audit                               |
+------+----------------------------+---------------------------------------+

### Current Implementation

The `User` struct includes a `role` field but it is not actively enforced
beyond planned admin aggregate views:

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
The tier is passed via the `X-User-Tier` header.

### Tiers

+------+-----------------+-------------------------------------+
| Tier | Description     | Feature Access                      |
+------+-----------------+-------------------------------------+
| free | Free tier       | Basic features only                 |
| pro  | Pro subscriber  | All features                        |
+------+-----------------+-------------------------------------+

### Default Behavior

```go
// chat_handler.go:112-114
userTier := c.Get("X-User-Tier")
if userTier == "" {
    userTier = "pro" // Default to pro for local backward-compatibility
}
```

## Feature Gates

### Feature Catalog Schema

```typescript
interface Feature {
  id: string;
  name: string;
  description: string;
  tier_requirement: "free" | "pro";
}
```

### Current Feature Catalog (agent-side)

The Hono Agent serves as the source of truth for the feature catalog via
`GET /api/features`. The Go gateway caches this in Redis.

### Tier Enforcement Flow

```
1. Go Gateway receives request with Features[] from client
2. Go fetches feature catalog (cached in Redis, TTL 10m)
3. For each requested feature:
   IF user tier == "free" AND feature.tier_requirement == "pro"
     -> REJECT with 403: "Feature 'X' requires a Pro subscription."
4. If all pass, forward to Agent with Features[]
```

### Code Implementation

```go
// chat_handler.go:117-136
for _, fID := range req.Features {
    if feat, exists := catalogMap[fID]; exists {
        if userTier == "free" && feat.TierRequirement == "pro" {
            span.RecordError(fmt.Errorf("access denied: feature %s requires pro", feat.Name))
            return c.Status(403).JSON(fiber.Map{
                "error": fmt.Sprintf("Feature '%s' requires a Pro subscription.", feat.Name),
            })
        }
    }
}
```

### Feature Response (Client-Facing)

```typescript
interface FeatureResponse {
  id: string;
  name: string;
  description: string;
  locked: boolean;    // true if free user requesting pro feature
}
```

## Feature Discovery

```
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   FRONTEND   │   │   GO BACKEND     │   │     REDIS        │   │     AGENT        │
└──────┬───────┘   └────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
       │                    │                       │                     │
       │  GET /features     │                       │                     │
       │  X-User-Tier:free  │                       │                     │
       │───────────────────►│                       │                     │
       │                    │                       │                     │
       │                    │  Check cache           │                     │
       │                    │  "agent:features"      │                     │
       │                    │──────────────────────►│                     │
       │                    │                       │                     │
       │                    │◄── MISS ──────────────│                     │
       │                    │                       │                     │
       │                    │  GET /api/features     │                     │
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

## Rate Limiting Tiers (Planned)

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

## Feature Constants

```typescript
// agent/src/app/api/missions/mission.constants.ts (implied features)
// The agent maintains a registry of features with tier requirements:
// - Features with tier_requirement: "free" -> available to all
// - Features with tier_requirement: "pro" -> free users see locked: true
```

## Entry Points & Exports

- **Tier check**: `backend/internal/handler/chat_handler.go:111-136` —
  X-User-Tier header processing
- **Feature response**: `backend/internal/handler/chat_handler.go:396-423` —
  HandleGetFeatures
- **Feature cache**: `backend/internal/handler/chat_handler.go:343-393` —
  GetFeatures with Redis TTL
- **Feature constants**: `agent/src/app/api/missions/mission.constants.ts`
  (implied)
- **Frontend feature discovery**:
  `frontend/web/src/features/chat/api/useFeatures.ts`
- **User role field**: `backend/internal/models/models.go:69`

## Source References

+-------------------------------------------------------+-------+---------------------------------------+
| File                                                  | Lines | Role                                  |
+-------------------------------------------------------+-------+---------------------------------------+
| backend/internal/handler/chat_handler.go              | 111-  | Tier validation loop                  |
|                                                       | 136   |                                       |
| backend/internal/handler/chat_handler.go              | 54-66 | Feature struct with tier_requirement  |
| backend/internal/handler/chat_handler.go              | 396-  | HandleGetFeatures with tier filtering  |
|                                                       | 423   |                                       |
| backend/internal/handler/chat_handler.go              | 342-  | GetFeatures with Redis caching        |
|                                                       | 393   |                                       |
| backend/internal/models/models.go                     | 64-72 | User struct with role field           |
| frontend/web/src/features/chat/api/useFeatures.ts     | 1-41  | Client-side feature discovery hook    |
+-------------------------------------------------------+-------+---------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
