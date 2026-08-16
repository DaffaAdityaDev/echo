================================================================================
  CONTEXT PROVISIONING
================================================================================
  Module    : Context Provisioning
  Service   : Shared / Architecture
  Version   : 1.1
  Updated   : 2026-08-04
================================================================================

## Description

The formal contract for how the agent gets everything it needs to execute a
mission. The governing principle:

- **Backend (Go) = source of truth.** It owns authentication, tier
  entitlements, model resolution, feature binding, and credential storage.
- **Agent (Hono) = stateless executor.** It holds no user credentials,
  entitlements, or billing state.
- **All identity, capability, and credential context is pushed per request**
  in the generate-mission payload.
- **The agent pulls only what is dynamic** — data that changes during a
  mission (memory, usage, quotas) — via authenticated internal endpoints.

This split keeps the agent horizontally scalable and safely disposable:
any mission payload fully describes the requesting user's entitlements for
that single execution.

## Push Contract (Backend -> Agent, per Request)

Everything the agent needs that is knowable before the mission starts is
pushed in the `POST /api/v1/generate-mission` payload. One round trip, atomic,
fast.

+----------------------+------------------------------------------+--------------------------------+--------------------------------------+
| Field                | Origin (backend)                         | Destination (agent schema)     | Source ref                           |
+----------------------+------------------------------------------+--------------------------------+--------------------------------------+
| user_id              | Chat handler payload build                | userId (normalized from        | chat/handler.go:341;                 |
|                      |                                          |   userId/user_id)              | mission.schema.ts:230,256            |
| message / prompt     | ChatRequest.Message                       | prompt (normalized from        | chat/handler.go:342;                 |
|                      |                                          |   prompt/message)              | mission.schema.ts:238,251            |
| model                | user_preferences.DefaultModel (default  | model                          | chat/handler.go:69-72,235;           |
|                      |   from config)                         |                                | mission.schema.ts:259                |
| history              | Session history (always from DB —      | history                        | chat/handler.go:180-201;             |
|                      |   never from the request)              |                                | mission.schema.ts:268-276            |
| provider_config      | Resolved via ModelService from per-user   | provider_config (type,         | chat/handler.go:201-230,345;         |
|   (incl. api_key)    |   stored keys (aimodel/service.go)        |   base_url, api_key, model)    | mission.schema.ts:4-9,260-265        |
| strategy_version     | Resolved/pinned by StrategyService        | strategy_version               | chat/handler.go:313-319,346;         |
|                      |                                          |                                | mission.schema.ts:237,253            |
| features             | Resolved from user_preferences, ALWAYS   | features                       | chat/handler.go:77,84-94;            |
|                      |   sent after tier gate — `[]` never      |                                | mission.schema.ts:266               |
|                      |   catalog (DB `features` table ∩ agent    |                                |                                     |
|                      |   implemented registry, GET /api/v1/features)|                                |                                     |
|                      |   — unknown feature → 400                 |                                |                                     |
| skills               | Sent only when non-empty (validated);    | skills                         | chat/handler.go:78,110-125;          |
|                      |   from user_preferences.DefaultSkills    |                                | mission.schema.ts:267                |
| config               | Sent only when non-empty; carries        | config (AgentConfigSchema:     | chat/handler.go:79-82,242;           |
|   (featureToggles)   |   featureToggles from user               |   featureToggles, memory,      | mission.schema.ts:156-215,277        |
|                      |   harness_toggles                        |   harness costCap 1.0)         |                                       |
| session_id         | Always sent — session id IS the run id   | sessionId (run id generated  | chat/handler.go:215-218,229;          |
|                    |                                          |   if absent)                 | mission.schema.ts:256,270            |
+----------------------+------------------------------------------+--------------------------------+--------------------------------------+

> **Note**: `tenant_id` / `org_id` are part of the agent schema but are not
> currently pushed by the chat handler — the agent defaults them
> (`DEFAULT_MISSION_VALUES` in mission.constants.ts:3-8). Pushing them
> explicitly from the backend is a future refinement, not a current behavior.

> **Note (catalog metadata)**: feature catalog metadata — tier_requirement,
> ui_schema, status — is owned by the **backend** PostgreSQL `features` table
> (migration 009_create_features). The agent's `GET /api/v1/features` returns
> only its implemented registry `[{id, name, description}]` (derived from its
> tool registry) and holds no catalog metadata. The effective catalog is the
> DB table ∩ agent implemented set; the agent rejects any requested feature id
> outside its implemented registry with HTTP 400
> `{"error": "Unknown feature '<id>'"}`.

The agent's own environment schema confirms the design: provider credentials
are NOT part of agent config — "keys are passed dynamically via
provider_config in payloads from Go Backend"
(`agent/src/config/env.schema.ts:4-7`).

## What the Agent MUST NOT Hold

+-------------------------------+---------------------------------------------------+
| Data                          | Why / Where it lives instead                       |
+-------------------------------+---------------------------------------------------+
| Per-user provider API keys    | Removed from server-level config; stored per-user  |
|                               |   encrypted in the DB (UserPreferences) — see      |
|                               |   `../contracts/env-contract.md`; passed per        |
|                               |   request via provider_config.api_key              |
| Tier / entitlement status     | Backend-only: tier from signed JWT `tier` claim,   |
|                               |   default `free` (least privilege); agent never    |
|                               |   receives the tier                                |
| Billing state / usage ledger  | No such field exists in mission.schema.ts; design  |
|                               |   in `../domain/usage-billing.md` puts it backend-  |
|                               |   side (single billing authority)                  |
+-------------------------------+---------------------------------------------------+

If a future agent payload asks for any of the above, the design is broken —
re-route it to the push contract or the pull contract below.

## Pull Contract (Agent -> Backend, Internal)

Data that changes during a mission is pulled on demand through internal
endpoints. Every call carries a **Service JWT** (sub "agent", HS256,
`SERVICE_JWT_SECRET`, 60s expiry) signed per request — see
`../contracts/internal-api-contract.md`.

### Existing Example: MemoryAdapter

`agent/src/adapter/outbound/backend/memory.adapter.ts`:

```
MemoryAdapter (agent/src/adapter/outbound/backend/memory.adapter.ts)
  base URL  : ENV.BACKEND_URL          (memory.adapter.ts:17)
  auth      : Authorization: Bearer <signServiceJwt()>   (memory.adapter.ts:51-58)
  store     : POST /api/v1/internal/memory/episodic/store     (memory.adapter.ts:6-9)
  recall    : POST /api/v1/internal/memory/episodic/recall    (memory.adapter.ts:6-9)
```

### Pattern for Future Adapters

New pull capabilities MUST follow the same shape:

1. New adapter under `agent/src/adapter/outbound/backend/`
2. Endpoint under backend's `/api/v1/internal/*` base path
3. Service JWT via `signServiceJwt()` (`agent/src/shared/utils/jwt.ts:14-22`)
4. Document the endpoint in `../contracts/internal-api-contract.md`

## Decision Rules

+-------------------------------------------------+-----------------------------------+
| Knowable BEFORE the mission starts?              | Mechanism                         |
+-------------------------------------------------+-----------------------------------+
| Yes — identity, tier-gated features, model,      | PUSH in generate-mission payload  |
|   provider credentials, strategy version,        |   (fast, atomic, one round trip)  |
|   harness/credential config                      |                                   |
| No — changes DURING the mission (memory,         | PULL via internal endpoint        |
|   usage/quotas, sandbox provisioning)            |   (Service JWT)                   |
+-------------------------------------------------+-----------------------------------+

## Diagram

```
                         PUSH (per request)
   ┌─────────────────────────────────────────────────────────────────────┐
   │  user_id, tenant_id*, org_id*, provider_config(+api_key),           │
   │  features (tier-checked; unknown id → 400), skills,                 │
   │  strategy_version,                                                   │
   │  config (mcpServers/restTools creds), session_id                    │
   │                                                                      │
   │  POST /api/v1/generate-mission  (X-Internal-Token)                      │
   ▼                                                                      ▼
┌──────────────────┐          ┌────────────────────────────────────┐
│  Go Backend      │─────────►│  Hono Agent (stateless executor)    │
│  source of truth │          │  mission.schema.ts validation       │
│  auth · tier ·   │          │  resolveTools() per features[]      │
│  model · creds   │          └────────────────────────────────────┘
│  Redis cache     │                    │
└─────────▲────────┘                    │  PULL (on demand)
          │                             │  Authorization: Bearer <Service JWT>
          │  POST /api/v1/internal/*    ▼
          │  (memory, usage, quota) ┌────────────────────────────────────┐
          └─────────────────────────│  Service JWT middleware (backend)  │
                                    │  sub=agent, HS256, exp 60s          │
                                    └────────────────────────────────────┘
```

*tenant_id / org_id: schema defaults agent-side today; see note above.

## Future Use Cases (Design Only)

+--------------------------------+---------------------------------------------------+
| Use case                       | Design notes                                       |
+--------------------------------+---------------------------------------------------+
| Usage / billing reporting      | Agent reports usage (SSE `usage` packet,           |
|                                |   `turn_complete.totalCost`) and/or a new internal  |
|                                |   endpoint; backend computes, persists, enforces    |
|                                |   quotas — see `../domain/usage-billing.md`         |
| Sandbox environment            | Agent requests ephemeral sandbox provisioning via   |
|   provisioning                 |   an internal endpoint (design TBD, follow the      |
|                                |   MemoryAdapter pattern)                            |
+--------------------------------+---------------------------------------------------+

## Entry Points & Exports

- **Push builder**: `backend/internal/handler/chat/handler.go:340-366`
- **Push schema**: `agent/src/adapter/inbound/api/missions/mission.schema.ts:217-279`
- **Consumption**: `agent/src/adapter/inbound/api/missions/mission.controller.ts:96-119`
  (unknown feature id -> 400; features -> resolveTools; skills -> preferredTools fallback)
- **Pull example**: `agent/src/adapter/outbound/backend/memory.adapter.ts`
- **Service JWT**: `agent/src/shared/utils/jwt.ts:14-22` +
  `../contracts/internal-api-contract.md`
- **Agent env (no keys)**: `agent/src/config/env.schema.ts:4-7` +
  `../contracts/env-contract.md`

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
