================================================================================
  API ENDPOINTS
================================================================================
  Module    : Endpoints
  Service   : Shared / Contracts
  Version   : 1.1
  Updated   : 2026-07-10 (added session CRUD + summarize endpoints)
================================================================================

## Description

Complete route table across all Echo services (Go Gateway, Agent Engine,
Frontend). Documents method, path, service ownership, auth requirements, and
planned rate limits.

## File Structure

+-------------------------------+--------------------------------------------+
| Location                      | Role                                       |
+-------------------------------+--------------------------------------------+
| backend/internal/constants/   |                                            |
|   routes/v1.go                | Route path constants                       |
| backend/internal/router/      |                                            |
|   router.go                   | Route wiring                               |
| backend/internal/handler/     |                                            |
|   auth_handler.go             | Auth endpoint handlers                     |
|   chat_handler.go             | Chat endpoint handlers                     |
|   memory_handler.go           | Internal memory endpoint handlers          |
|   model_handler.go            | Model endpoint handlers                    |
| agent/src/index.ts            | Hono app entry                             |
| agent/src/app/api/missions/   |                                            |
|   mission.controller.ts       | Mission generation endpoint                |
| agent/src/app/middleware/     |                                            |
|   auth.ts                     | Agent auth middleware                      |
| frontend/web/src/lib/         |                                            |
|   api-client.ts               | Unified HTTP/SSE client                    |
| frontend/web/src/features/    |                                            |
|   chat/constants.ts           | CHAT_ENDPOINTS constants                   |
|   auth/constants/index.ts     | AUTH_ENDPOINTS constants                   |
+-------------------------------+--------------------------------------------+

## Public API Routes (Go Gateway)

Base path: `/api/v1`

+--------+----------------------------------+---------+--------+----------------------------------+--------+
| Method | Path                             | Service | Auth   | Description                      | Status |
+--------+----------------------------------+---------+--------+----------------------------------+--------+
| GET    | /health                          | Go      | None   | Health check                     | Active |
| GET    | /v1/features                     | Go      | None   | Get feature catalog              | Active |
| GET    | /v1/models                       | Go      | Opt.   | List available LLM models        | Active |
| GET    | /v1/skills                       | Go      | None   | List active agent skills catalog | Active |
| POST   | /v1/auth/login                   | Go      | None   | Login, returns JWT               | Active |
| POST   | /v1/auth/register                | Go      | None   | Register user                    | Active |
| GET    | /v1/auth/me                      | Go      | JWT    | Retrieve current logged-in user  | Active |
| POST   | /v1/auth/logout                  | Go      | JWT    | Invalidate session/logout        | Active |
| POST   | /v1/chat                         | Go      | JWT    | Send message, get SSE stream     | Active |
| GET    | /v1/missions/:missionId/stream   | Go      | JWT    | SSE mission log stream           | Active |
| POST   | /v1/sessions                     | Go      | JWT    | Create session                   | Active |
| GET    | /v1/sessions                     | Go      | JWT    | List sessions (by user)          | Active |
| GET    | /v1/sessions/:id                 | Go      | JWT    | Load session metadata & history  | Active |
| GET    | /v1/sessions/:id/messages         | Go      | JWT    | Get session messages             | Active |
| DELETE | /v1/sessions/:id                 | Go      | JWT    | Soft delete session              | Active |
| GET    | /v1/settings                     | Go      | JWT    | Get user preferences             | Active |
| PUT    | /v1/settings                     | Go      | JWT    | Update user preferences          | Active |
| GET    | /v1/settings/defaults            | Go      | None   | Get system default preferences   | Active |
+--------+----------------------------------+---------+--------+----------------------------------+--------+

### Route Constants (Go)

```go
V1APIPrefix       = "/api/v1"
V1AuthGroup       = "/auth"
V1PathHealth      = "/health"
V1PathRegister    = "/register"
V1PathLogin       = "/login"
V1PathMe          = "/me"
V1PathLogout      = "/logout"
V1PathChat        = "/chat"
V1PathSkills      = "/skills"
V1PathModels      = "/models"
V1PathFeatures    = "/features"
V1PathSettings    = "/settings"
V1PathSettingsDefaults = "/settings/defaults"
V1AdminGroup      = "/admin"
V1PathAPIKeys     = "/api-keys"
V1PathAPIKey      = "/api-keys/:id"
V1PathStats       = "/stats"
```

## Admin API Routes (Go Gateway)

Base path: `/api/v1/admin`
Auth: User JWT (admin role) or valid admin `X-API-Key`.

+--------+----------------------------------+---------+--------------------+----------------------------------+--------+
| Method | Path                             | Service | Auth               | Description                      | Status |
+--------+----------------------------------+---------+--------------------+----------------------------------+--------+
| GET    | /v1/admin/api-keys               | Go      | JWT / API Key      | List all registered API keys     | Active |
| POST   | /v1/admin/api-keys               | Go      | JWT / API Key      | Provision a new API key          | Active |
| DELETE | /v1/admin/api-keys/:id           | Go      | JWT / API Key      | Revoke an API key                | Active |
| GET    | /v1/admin/stats                  | Go      | JWT / API Key      | Retrieve system usage statistics | Active |
+--------+----------------------------------+---------+--------------------+----------------------------------+--------+

## Internal Routes (Go Gateway — Memory & Session Authority)

Base path: `/api/v1/internal`

These routes serve the agent's memory and state persistence needs. The agent must present a valid **Service JWT** (signed with `SERVICE_JWT_SECRET`, `sub: agent`) or internal header token. These are NOT accessible to end users.

+--------+------------------------------------------+---------+--------------------+----------------------------------+--------+
| Method | Path                                     | Service | Auth               | Description                      | Status |
+--------+------------------------------------------+---------+--------------------+----------------------------------+--------+
| POST   | /v1/internal/memory/episodic/store       | Go      | Service JWT        | Store episodic memory            | Active |
| POST   | /v1/internal/memory/episodic/recall      | Go      | Service JWT        | Recall episodic memories         | Active |
| POST   | /v1/internal/memory/semantic/store       | Go      | Service JWT        | Store semantic memory            | Active |
| POST   | /v1/internal/memory/semantic/search      | Go      | Service JWT        | Search semantic memories         | Active |
| POST   | /v1/internal/memory/procedural/store     | Go      | Service JWT        | Store procedural memory          | Active |
| POST   | /v1/internal/memory/procedural/get        | Go      | Service JWT        | Retrieve procedural instructions | Active |
| POST   | /v1/internal/sessions/:id/prune          | Go      | Service JWT        | Trigger manual session pruning   | Active |
+--------+------------------------------------------+---------+--------------------+----------------------------------+--------+

**Auth**: All internal routes require `Authorization: Bearer <service JWT>` or matching headers. The JWT must be signed with `SERVICE_JWT_SECRET` (different from `JWT_SECRET` used for user tokens). The `sub` claim must be `"agent"`. See `docs/shared/contracts/internal-api-contract.md` for full request/response contracts.

## Internal Agent Routes (Hono)

Base path: `/api`

+--------+--------------------------------------------+---------+----------+----------------------------------+--------+
| Method | Path                                       | Service | Auth     | Description                      | Status |
+--------+--------------------------------------------+---------+----------+----------------------------------+--------+
| GET    | /                                          | Agent   | None     | Health check (bypass)            | Active |
| POST   | /api/generate-mission                      | Agent   | Internal | Execute mission (SSE stream)     | Active |
| GET    | /api/models                                | Agent   | Internal | List models from LLM provider    | Active |
| GET    | /api/features                              | Agent   | Internal | Master feature catalog           | Active |
| POST   | /api/internal/sessions/summarize           | Agent   | Internal | Perform LLM session summary      | Active |
+--------+--------------------------------------------+---------+----------+----------------------------------+--------+

**Auth**: All agent routes (except `/`) require `X-Internal-Token` or `Authorization: Bearer <token>` matching `INTERNAL_AUTH_TOKEN`.

**Planned:**
+--------+--------------------------------------------+---------+----------+----------------------------------+
| Method | Path                                       | Service | Auth     | Description                      |
+--------+--------------------------------------------+---------+----------+----------------------------------+
| GET    | /api/v1/missions/:missionId/stream         | Agent   | Internal | Mission log stream (local mode)  |
+--------+--------------------------------------------+---------+----------+----------------------------------+

**Auth**: All agent routes (except `/`) require `X-Internal-Token` or
`Authorization: Bearer <token>` matching `INTERNAL_AUTH_TOKEN`.

## Frontend Endpoint Constants

```typescript
// chat/constants.ts
CHAT_ENDPOINTS = {
  STREAM: "/chat/stream",
}

// auth/constants (implied)
AUTH_ENDPOINTS = {
  LOGIN: "/auth/login",
  LOGOUT: "/auth/logout",
  ME: "/auth/me",
}
```

Frontend calls Go gateway. The `api-client.ts` prefixes all requests with
`/api/v1`.

## Planned Endpoints (MVP)

From `docs/architecture-plan.md` — not yet implemented:

+--------+------------------------+---------+--------------------------------------+
| Method | Path                   | Service | Description                          |
+--------+------------------------+---------+--------------------------------------+
| POST   | /v1/goal               | Go      | Create goal, auto-generate skill DAG |
| GET    | /v1/goal/:id           | Go      | Get goal with skill tree             |
| POST   | /v1/topic              | Go      | Create topic                         |
| POST   | /v1/topic/import       | Go      | Bulk import (CSV/Markdown)           |
| GET    | /v1/cards/today        | Go      | Get today's spaced-rep cards         |
| POST   | /v1/answer             | Go      | Submit answer, get LLM evaluation    |
| POST   | /v1/mission/generate   | Go      | Request mission generation           |
| GET    | /v1/mission            | Go      | Get user's missions                  |
| POST   | /v1/refresh            | Go      | Refresh access token                 |
+--------+------------------------+---------+--------------------------------------+

## Rate Limits (Planned)

+---------------------------+-----------+--------+-----------+
| Endpoint                  | Limit     | Window | Scope     |
+---------------------------+-----------+--------+-----------+
| /v1/chat                  | 30 req/min| 1 min  | Per user  |
| /v1/auth/login            | 5 req/min | 1 min  | Per IP    |
| /v1/mission/generate      | 10 req/min| 1 min  | Per user  |
| /v1/features              | 60 req/min| 1 min  | Per IP    |
| /v1/models                | 60 req/min| 1 min  | Per IP    |
| Agent internal            | 100 req/  | 1 min  | Per       |
|                           | min       |        | internal  |
|                           |           |        | token     |
+---------------------------+-----------+--------+-----------+

## Service-to-Service Internal Endpoints

+-----------+-------------+--------+------------------------------------------+-----------------------+
| Source    | Target      | Method | Path                                     | Auth Mechanism        |
+-----------+-------------+--------+------------------------------------------+-----------------------+
| Go Gateway| Agent Hono  | POST   | /api/generate-mission                    | X-Internal-Token      |
| Go Gateway| Agent Hono  | GET    | /api/features                            | X-Internal-Token      |
| Go Gateway| Agent Hono  | GET    | /api/models                              | X-Internal-Token      |
| Go Gateway| Agent Hono  | POST   | /api/internal/sessions/summarize         | X-Internal-Token      |
| Go Gateway| Redis       | Pub/Sub| stream:{missionId}                       | Network isolation     |
| Agent     | Go Gateway  | POST   | /api/v1/internal/memory/episodic/store   | Service JWT (Bearer)  |
| Agent     | Go Gateway  | POST   | /api/v1/internal/memory/episodic/recall  | Service JWT (Bearer)  |
| Agent     | Go Gateway  | POST   | /api/v1/internal/memory/semantic/store   | Service JWT (Bearer)  |
| Agent     | Go Gateway  | POST   | /api/v1/internal/memory/semantic/search  | Service JWT (Bearer)  |
| Agent     | Go Gateway  | POST   | /api/v1/internal/memory/procedural/store | Service JWT (Bearer)  |
| Agent     | Go Gateway  | POST   | /api/v1/internal/memory/procedural/get    | Service JWT (Bearer)  |
| Agent     | Go Gateway  | POST   | /api/v1/internal/sessions/:id/prune      | Service JWT (Bearer)  |
| Frontend  | Go Gateway  | GET    | /api/v1/settings                         | User JWT (Bearer)     |
| Frontend  | Go Gateway  | PUT    | /api/v1/settings                         | User JWT (Bearer)     |
| Frontend  | Go Gateway  | GET    | /api/v1/settings/defaults                | None                  |
+-----------+-------------+--------+------------------------------------------+-----------------------+

**Planned:**
+-----------+-------------+--------+----------------------------+---------------------+
| Go Gateway| Agent Hono  | GET    | /api/v1/missions/:id/stream| X-Internal-Token    |
+-----------+-------------+--------+----------------------------+---------------------+

## Entry Points & Exports

- **Go route definitions**: `backend/internal/constants/routes/v1.go`
- **Go route wiring**: `backend/internal/router/router.go`
- **Agent app**: `agent/src/index.ts`
- **Frontend API client**: `frontend/web/src/lib/api-client.ts`

## Dependencies

- **Go router**: `gofiber/fiber/v3`
- **Agent router**: `hono`
- **Frontend HTTP**: native `fetch` via `lib/api-client.ts`

## Source References

+-------------------------------------------------+-------+----------------------------------+
| File                                            | Lines | Role                             |
+-------------------------------------------------+-------+----------------------------------+
| backend/internal/constants/routes/v1.go         | 1-16  | All path constants               |
| backend/internal/router/router.go               | 15-52 | Route wiring with handler        |
|                                                 |       |   injection                      |
| backend/internal/middleware/service_auth.go     | 1-52  | Service JWT verification MW      |
| agent/src/app/middleware/auth.ts                | 6-32  | Agent auth bypass for /          |
| frontend/web/src/features/chat/constants.ts     | 31-34 | Frontend endpoint constants      |
| frontend/web/src/lib/api-client.ts              | 14-51 | Base URL construction,           |
|                                                 |       |   traceparent propagation        |
+-------------------------------------------------+-------+----------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
