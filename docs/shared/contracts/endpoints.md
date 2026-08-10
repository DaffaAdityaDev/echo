================================================================================
  API ENDPOINTS
================================================================================
  Module    : Endpoints
  Service   : Shared / Contracts
   Version   : 1.5
   Updated   : 2026-08-10 (optional model/mode overrides on chat request)
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
|   router.go                   | Route wiring + docs serving                |
| backend/internal/handler/     |                                            |
|   auth/handler.go             | Auth endpoint handlers                     |
|   chat/handler.go             | Chat endpoint handlers                     |
|   memory/handler.go           | Internal memory endpoint handlers          |
|   aimodel/handler.go          | Model endpoint handlers                    |
| backend/api/docs/swagger.json | Generated monolithic OpenAPI 2.0 spec      |
| backend/api/module/*.json     | Split per-module spec files (see           |
|                               |   docs/backend/application/patterns/       |
|                               |   docs-api.md for pipeline details)        |
| backend/api/split/main.go     | Modular split tool                         |
| agent/src/index.ts            | Hono app entry                             |
| agent/src/adapter/inbound/api/missions/   |                                            |
|   mission.controller.ts       | Mission generation endpoint                |
| agent/src/adapter/inbound/middleware/     |                                            |
|   auth.ts                     | Agent auth middleware                      |
| agent/api/openapi.json        | Hand-authored OpenAPI 3.0 spec             |
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
| GET    | /v1/models                       | Go      | JWT    | List available LLM models        | Active |
| GET    | /v1/skills                       | Go      | None   | List active agent skills catalog | Active |
| POST   | /v1/auth/login                   | Go      | None   | Login, returns JWT               | Active |
| POST   | /v1/auth/register                | Go      | None   | Register user                    | Active |
| GET    | /v1/auth/me                      | Go      | JWT    | Retrieve current logged-in user  | Active |
| POST   | /v1/auth/logout                  | Go      | JWT    | Invalidate session/logout        | Active |
| POST   | /v1/chat                         | Go      | JWT    | Send message, get SSE stream     | Active |
| POST   | /v1/sessions                     | Go      | JWT    | Create session                   | Active |
| GET    | /v1/sessions                     | Go      | JWT    | List sessions (by user)          | Active |
| GET    | /v1/sessions/:id                 | Go      | JWT    | Load session metadata & history  | Active |
| GET    | /v1/sessions/:id/messages         | Go      | JWT    | Get session messages             | Active |
| PATCH  | /v1/sessions/:id                 | Go      | JWT    | Update session metadata          | Active |
| DELETE | /v1/sessions/:id                 | Go      | JWT    | Soft delete session              | Active |
| POST   | /v1/sessions/:id/generate-title  | Go      | JWT    | Auto-generate session title via LLM | Active |
| GET    | /v1/settings                     | Go      | JWT    | Get user preferences             | Active |
| PUT    | /v1/settings                     | Go      | JWT    | Update user preferences          | Active |
| GET    | /v1/settings/defaults            | Go      | None   | Get system default preferences   | Active |
| GET    | /v1/strategies                   | Go      | JWT    | List strategy catalog w/ rollout | Active |
| POST   | /v1/sessions/:id/approve         | Go      | JWT    | Approve HITL tool call           | Active |
| POST   | /v1/sessions/:id/deny            | Go      | JWT    | Deny HITL tool call              | Active |
+--------+----------------------------------+---------+--------+----------------------------------+--------+

> **HITL proxy**: `POST /api/v1/sessions/:id/approve` and
> `POST /api/v1/sessions/:id/deny` accept the HITL decision body
> (`{approvalId, decision, reason?}`), forward it to the agent
> (`/api/v1/sessions/:id/approve|deny`) with `X-Internal-Token`, and relay the
> resume-execution SSE stream back to the client. See
> `docs/shared/contracts/internal-api-contract.md`.

> **Strategy Lifecycle**: `GET /api/v1/strategies` returns the agent's
> strategy catalog (name, versions, status `active`/`deprecated`, aliases) merged
> with the gateway's rollout configuration from `app_settings`. The gateway also
> resolves `strategy_version` for `/chat` requests (session pin → rollout %).
> See `docs/shared/patterns/strategy-lifecycle.md`.

> **Chat Contract**: `POST /api/v1/chat` accepts
> `{ "message": "string (required)", "sessionId": "string (optional)" }`.
> `model`/`mode` are optional per-request overrides (used by clients without a
> user identity, e.g. the Discord bot's per-channel selection); the web client
> omits them. No `sessionId` → the gateway creates a new session (this message
> becomes turn 1). With `sessionId` → the message is appended to that session
> (append-only, never replace). All config (model, mode, features, skills,
> harness feature toggles) is resolved SERVER-SIDE per request from the
> user's global settings (`user_preferences`, GET/PUT `/api/v1/settings`);
> the chat request carries no features/skills/history fields.
> History is always loaded server-side from the session's DB messages. The
> response always sets the `X-Session-ID` header with the session id in use —
> the frontend reads it to learn the id of a newly created session.

> **Note**: `GET /api/v1/models` now requires JWT auth (was optional). Model
> listing is per-user — it reads the authenticated user's provider config
> (provider type, API key, base URL) from their `UserPreferences` and fetches
> models from their configured provider. If no API key is set for the user and
> the provider is not `lm-studio`, an empty list is returned.

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
V1PathStrategies  = "/strategies"   // Active — strategy catalog + rollout
V1AdminGroup      = "/admin"
V1InternalGroup   = "/internal"
V1PathDocs        = "/docs"
```

`/api-keys` and `/stats` are registered as **inline strings** in router.go
(admin group) — no V1PathAPIKeys/V1PathAPIKey/V1PathStats constants exist.

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

## Studio API Routes (Go Gateway — LLMOps)

Base path: `/api/v1/studio`

Role-gated endpoints for prompt engineering.

+--------+---------------------------------------------+---------+----------------------+----------------------------------+--------+
| Method | Path                                        | Service | Auth                 | Description                      | Status |
+--------+---------------------------------------------+---------+----------------------+----------------------------------+--------+
| GET    | /v1/studio/prompts                          | Go      | User JWT             | List all prompt templates        | Active |
| POST   | /v1/studio/prompts                          | Go      | User JWT + Role      | Create template (role-gated)     | Active |
| GET    | /v1/studio/prompts/active                   | Go      | User JWT             | Get active prompt by name        | Active |
| GET    | /v1/studio/prompts/:id/versions             | Go      | User JWT             | List versions for a template     | Active |
| GET    | /v1/studio/prompts/:id/versions/:v          | Go      | User JWT             | Get specific version             | Active |
| POST   | /v1/studio/prompts/:id/versions             | Go      | User JWT + Role      | Create version (role-gated)      | Active |
| POST   | /v1/studio/prompts/:id/promote/:version     | Go      | User JWT + Role      | Promote version (role-gated)     | Active |
| POST   | /v1/studio/prompts/:id/rollback/:version    | Go      | User JWT + Role      | Rollback version (role-gated)    | Active |
+--------+---------------------------------------------+---------+----------------------+----------------------------------+--------+

## Internal Routes (Go Gateway — Memory, Sessions & Prompts)

Base path: `/api/v1/internal`

These routes serve the agent's memory, state persistence, and prompt
retrieval needs. The agent must present a valid **Service JWT** (signed
with `SERVICE_JWT_SECRET`, `sub: agent`) via `Authorization: Bearer`. These
are NOT accessible to end users.

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
| GET    | /v1/internal/prompts/active              | Go      | Service JWT        | Get active prompt for the agent  | Active |
+--------+------------------------------------------+---------+--------------------+----------------------------------+--------+

**Auth**: All internal routes accept ONLY `Authorization: Bearer <service JWT>`. The JWT must be signed with `SERVICE_JWT_SECRET` (different from `JWT_SECRET` used for user tokens). The `sub` claim must be `"agent"`. `GET /v1/internal/prompts/active` additionally reads the optional `X-Tenant-ID` header (defaults to `local`) for per-tenant prompt resolution. See `docs/shared/contracts/internal-api-contract.md` for full request/response contracts.

## Internal Agent Routes (Hono)

Base path: `/api`

+--------+--------------------------------------------+---------+----------+----------------------------------+--------+
| Method | Path                                       | Service | Auth     | Description                      | Status |
+--------+--------------------------------------------+---------+----------+----------------------------------+--------+
| GET    | /                                          | Agent   | None     | Health check (bypass)            | Active |
| POST   | /api/generate-mission                      | Agent   | Internal | Execute mission (SSE stream)     | Active |
| GET    | /api/models                                | Agent   | Internal | List models from LLM provider    | Active |
| GET    | /api/features                              | Agent   | Internal | Implemented tool registry ([{id,name,description}]) | Active |
| GET    | /api/strategies                            | Agent   | Internal | Strategy catalog (versions/status)| Active |
| POST   | /api/v1/sessions/:id/approve               | Agent   | Internal | Approve HITL tool call, resume run (SSE) | Active |
| POST   | /api/v1/sessions/:id/deny                  | Agent   | Internal | Deny HITL tool call, resume run (SSE) | Active |
| POST   | /api/internal/sessions/summarize           | Agent   | Internal | Perform LLM session summary      | Active |
+--------+--------------------------------------------+---------+----------+----------------------------------+--------+

**Auth**: All agent routes (except `/`) require `X-Internal-Token` or `Authorization: Bearer <token>` matching `INTERNAL_AUTH_TOKEN`.

## Frontend Endpoint Constants

```typescript
// chat/constants.ts
CHAT_ENDPOINTS = {
  STREAM: "/chat/stream",
}

// auth/constants.ts
AUTH_ENDPOINTS = {
  LOGIN: "/auth/login",
  LOGOUT: "/auth/logout",
  ME: "/auth/me",
}

// studio/constants.ts
STUDIO_ENDPOINTS = {
  PROMPTS: "/studio/prompts",
  PROMPTS_ACTIVE: (name) => `/studio/prompts/active?name=${encodeURIComponent(name)}`,
  PROMPT_VERSIONS: (id) => `/studio/prompts/${id}/versions`,
  PROMPT_VERSION: (id, v) => `/studio/prompts/${id}/versions/${v}`,
  PROMPT_PROMOTE: (id, v) => `/studio/prompts/${id}/promote/${v}`,
  PROMPT_ROLLBACK: (id, v) => `/studio/prompts/${id}/rollback/${v}`,
  MATURITY: "/studio/maturity",
  MATURITY_CLIENT: "/studio/maturity/client",
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
| Go Gateway| Agent Hono  | GET    | /api/strategies                          | X-Internal-Token      |
| Go Gateway| Agent Hono  | GET    | /api/models                              | X-Internal-Token      |
| Go Gateway| Agent Hono  | POST   | /api/v1/sessions/:id/approve             | X-Internal-Token      |
| Go Gateway| Agent Hono  | POST   | /api/v1/sessions/:id/deny                | X-Internal-Token      |
| Go Gateway| Agent Hono  | POST   | /api/internal/sessions/summarize         | X-Internal-Token      |
| Agent     | Go Gateway  | POST   | /api/v1/internal/memory/episodic/store   | Service JWT (Bearer)  |
| Agent     | Go Gateway  | POST   | /api/v1/internal/memory/episodic/recall  | Service JWT (Bearer)  |
| Agent     | Go Gateway  | POST   | /api/v1/internal/memory/semantic/store   | Service JWT (Bearer)  |
| Agent     | Go Gateway  | POST   | /api/v1/internal/memory/semantic/search  | Service JWT (Bearer)  |
| Agent     | Go Gateway  | POST   | /api/v1/internal/memory/procedural/store | Service JWT (Bearer)  |
| Agent     | Go Gateway  | POST   | /api/v1/internal/memory/procedural/get    | Service JWT (Bearer)  |
| Agent     | Go Gateway  | POST   | /api/v1/internal/sessions/:id/prune      | Service JWT (Bearer)  |
| Agent     | Go Gateway  | GET    | /api/v1/internal/prompts/active          | Service JWT (Bearer)  |
| Frontend  | Go Gateway  | GET    | /api/v1/settings                         | User JWT (Bearer)     |
| Frontend  | Go Gateway  | PUT    | /api/v1/settings                         | User JWT (Bearer)     |
| Frontend  | Go Gateway  | GET    | /api/v1/settings/defaults                | None                  |
+-----------+-------------+--------+------------------------------------------+-----------------------+

> **Planned** (from `docs/architecture-plan.md`, not implemented): goal/topic/
> card/answer/mission CRUD — see the Planned Endpoints table below.

## Entry Points & Exports

- **Go route definitions**: `backend/internal/constants/routes/v1.go`
- **Go route wiring**: `backend/internal/router/router.go`
- **Go modular spec pipeline**: `backend/api/split/main.go`
- **Go modular spec files**: `backend/api/module/*.json`
- **Go monolithic spec**: `backend/api/docs/swagger.json`
- **Agent app**: `agent/src/index.ts`
- **Agent OpenAPI spec**: `agent/api/openapi.json`
- **Frontend API client**: `frontend/web/src/lib/api-client.ts`

## Dependencies

- **Go router**: `gofiber/fiber/v3`
- **Agent router**: `hono`
- **Frontend HTTP**: native `fetch` via `lib/api-client.ts`

## Source References

+-------------------------------------------------+-------+----------------------------------+
| File                                            | Lines | Role                             |
+-------------------------------------------------+-------+----------------------------------+
| backend/internal/constants/routes/v1.go         | 1-16  | Route path constants              |
| backend/internal/router/router.go               | 15-180| Route wiring with handler        |
|                                                 |       |   injection                      |
| backend/api/split/main.go                      | 1-295 | Modular spec split tool          |
| backend/internal/middleware/internal_auth.go     | 1-52  | Service JWT verification MW      |
| agent/src/adapter/inbound/middleware/auth.ts                | 6-32  | Agent auth bypass for /          |
| frontend/web/src/features/chat/constants.ts     | 31-34 | Frontend chat endpoint constants |
| frontend/web/src/features/studio/constants.ts   | 1-25  | Frontend studio endpoint constants|
| frontend/web/src/lib/api-client.ts              | 14-51 | Base URL construction,           |
|                                                 |       |   traceparent propagation        |
| backend/internal/handler/llmops/                | 1-450 | Studio handler group             |
| backend/internal/service/llmops/                | 1-350 | Studio service layer (prompts,   |
|                                                 |       |   maturity)                      |
| backend/internal/handler/llmops/                | 1-40  | Internal active prompt endpoint  |
|                                                 |       |   (agent_prompt_handler.go)      |
| backend/internal/repository/llmops/module/      | 1-500 | Studio repository layer (props)  |
+-------------------------------------------------+-------+----------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
