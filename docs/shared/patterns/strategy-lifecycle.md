===============================================================================
  STRATEGY LIFECYCLE — VERSIONING, CANARY ROLLOUT & SUNSET
===============================================================================
  Module    : Strategy Lifecycle
  Service   : Shared / Patterns
  Version   : 1.0
  Updated   : 2026-07-31 (active — code follows this contract)
===============================================================================

## Description

Canonical pattern for delivering agent strategies **without downtime**:
versioned strategy contract, session pinning for backward compatibility, canary
rollout via gateway-owned feature flags, and a 3-phase sunset pipeline.

Design principle: the agent's **code** is the ground truth for "what is
exported"; the gateway's **settings table** is the ground truth for "what is
active and at what percentage". Code and data never describe the same thing,
so they cannot desynchronize.

---

## Versioning Contract

- Strategy versions follow the format `{name}:v{n}` — e.g. `nlah:v1`,
  `standard:v1`.
- **Never overwrite a version in place.** New behavior ships as `{name}:v2`.
- `StrategyFactory` remains the only constructor of strategy instances; the
  registry (`agent/src/core/agent/strategies/registry.ts`) only adds versioned
  metadata on top and resolves version strings back to the factory.

> The agent currently registers exactly two versions: `standard:v1` and
> `nlah:v1` (see `strategies/constants.ts`). There is no `deep-research`
> version — `deep-research` exists only as an alias of `nlah:v1`.

```
┌──────────────────────────────────────────────────────────────┐
│ AGENT CODE (registry.ts) — "what is exported?"               │
│  list(): [{ name, versions: [{ version, status, aliases }] }]│
│  resolve('nlah:v1') -> AgentStrategy (via factory)           │
│  exposed: GET /api/strategies                                │
└──────────────────────────────┬───────────────────────────────┘
                               │ (merge)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ GATEWAY (settings table JSONB) — "what is active?"           │
│  strategy_rollout = { "nlah:v1": { rollout: 0.2 } }          │
│  GET /api/v1/strategies (catalog + rollout)                  │
│  resolveStrategyVersion(session, rollout) -> "nlah:v1"       │
└──────────────────────────────────────────────────────────────┘
```

---

## Request Resolution (Gateway)

Applied in `HandleChat` after session ownership check:

1. If `sessions.strategy_version != ''` → **use the pinned version**
   (backward compatibility for active sessions — never migrate mid-session).
2. Else if the client sent `strategy_version` and it is active → use it.
3. Else → resolve from rollout config (deterministic fraction for canary),
   then **write the pin** to `sessions.strategy_version`.
4. Deprecated versions are excluded from steps 2-3 (but still honored by
   step 1).

The resolved version is forwarded to the agent as `strategy_version` in the
`POST /api/generate-mission` payload.

---

## Canary Rollout

- Rollout is stored per version in `settings` (JSONB). **Only versions with an
  entry in `strategy_rollout` are eligible for canary routing**; unconfigured
  versions are never selected by rollout (explicit client request or session
  pin only). An empty/unset `strategy_rollout` means no canary — every new
  session resolves to the default version.
- A rollout entry may omit the percentage; the value then defaults to
  `STRATEGY_ROLLOUT_DEFAULT` (0.1 = 10%).
- Rollout `0` = rollback: the version is excluded from canary routing but stays
  available via explicit request and for pinned sessions.
- Only **new sessions** are routed by rollout; pinned sessions stay on their
  version until they finish — this is the zero-downtime guarantee.
- Rollout bump (0.1 → 1.0) only affects sessions created after the change.
- Rollback = set rollout to 0 or remove the version from settings; pinned
  sessions continue on the old version safely.

---

## Sunset Pipeline (3 Phases)

| Phase | Action | Implementation |
| --- | --- | --- |
| 1 — Soft deprecation | Version marked `deprecated` in registry; hidden from new-session resolution and UI toggle | `status: 'deprecated'` in registry metadata; gateway excludes from steps 2-3 |
| 2 — Zero-traffic alarm | Telemetry (Prometheus/Grafana) monitors pinned-session usage of the version; alarm when traffic = 0 | Metric: `echo_strategy_sessions_active{version}` from `sessions.strategy_version` [Planned] |
| 3 — Decommission | After all pinned sessions drain (traffic 0 for N days), remove version from registry; sessions with the stale pin fall back to default resolution | Registry entry deleted; fallback rule in `resolveStrategyVersion` [Planned] |

> **Not implemented:** the Phase-3 stale-pin fallback does NOT exist. A
> session pin is honored **unconditionally** — `ResolveVersion`
> (`backend/internal/service/strategy/service.go:154-157`) returns the pinned
> version as-is, with no status check or fallback. A session pinned to a
> decommissioned version would keep requesting it.
>
> **Latent issue:** `POST /api/v1/sessions` accepts deprecated versions.
> `IsValidVersion` (`service.go:135-152`) matches against version strings and
> aliases but **ignores `status`**, so `HandleCreateSession`
> (`session/handler.go:93-97`) lets new sessions pin deprecated versions.

---

## Data & Session Pin (Schema)

- `sessions.strategy_version TEXT DEFAULT ''` (migration 006) — set once at
  session creation / first turn, never updated.
- Pin is immutable: sessions survive strategy upgrades, sunset, and rollback
  unchanged.
- Session lifecycle (archival/deletion) is independent of strategy lifecycle —
  see `docs/backend/infrastructure/server-lifecycle.md` (lifecycle worker).

---

## Deployment Semantics

- **New strategy version** = new code in `registry.ts` + container deploy of
  the stateless agent (rolling update). No gateway restart, no downtime.
- **Activation** (rollout %) = settings change only, no deploy.
- **Deprecation** = registry metadata change + rollout removal, no deploy.
- The gateway caches the strategy catalog in Redis (10 min, same pattern as
  `agent:features`) and the rollout in `strategy:rollout`.

---

## Entry Points & Exports

- **Agent registry**: `agent/src/core/agent/strategies/registry.ts` [Active]
- **Agent endpoint**: `GET /api/strategies` [Active]
- **Gateway endpoint**: `GET /api/v1/strategies` [Active]
- **Gateway resolver**: `backend/internal/service/strategy/` [Active]
- **Schema**: `sessions.strategy_version` (migration 006) [Active]
- **Settings key**: `strategy_rollout` (JSONB in `app_settings` table) [Active]


## Dependencies

- **Agent**: `StrategyFactory` (`strategies/factory.ts`) — unchanged core
- **Gateway**: settings service (existing), Redis cache (existing), session
  repository (existing)
- **Observability**: `echo_strategy_sessions_active{version}` metric (Phase 2
  sunset) [Planned]

## Source References

+------------------------------------------------------+------------------------------------------+
| Ref                                                  | Role                                     |
+------------------------------------------------------+------------------------------------------+
| docs/agent/application/features/execution/strategy-pattern.md | Strategy registry + versions    |
| docs/shared/contracts/json-api-contract.md           | /chat + /strategies payload schemas      |
| docs/shared/contracts/database-schema.md             | sessions.strategy_version (006)          |
| docs/shared/contracts/env-contract.md                | STRATEGY_ROLLOUT_DEFAULT                 |
| docs/backend/application/features/chat-streaming.md  | Gateway resolution flow                  |
| docs/backend/infrastructure/server-lifecycle.md      | Lifecycle worker (rollout cache refresh) |
+------------------------------------------------------+------------------------------------------+

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
