================================================================================
  USAGE & BILLING
================================================================================
  Module    : Usage & Billing
  Service   : Shared / Domain
  Version   : 1.0
  Updated   : 2026-08-04
  Status    : Design / Planned — NOT implemented
================================================================================

## Description

Design for per-user/tier usage accounting and quota enforcement, with the
backend (Go) as the **single billing authority**. The agent executes missions
but never holds billing state; it only reports raw usage. Nothing in this
document is implemented — it is a design record to guide future work.

## Goal

- Account per-user/tier usage (tokens, cost, mission counts).
- Enforce quota limits per tier before/while work proceeds.
- Keep the backend as the sole authority on entitlements, ledger, and cost
  (consistent with the context provisioning contract — see
  `../architecture/context-provisioning.md`).

## Existing Foundations (Implemented Today)

The pieces this design builds on already exist:

+-----------------------------------+-----------------------------------------------------+
| Foundation                        | Where it lives                                      |
+-----------------------------------+-----------------------------------------------------+
| SSE `usage` packet                | Streamed by the agent per turn —                    |
|                                   |   `../contracts/json-api-contract.md` (line ~178):  |
|                                   |   `{ "type": "usage", "usage": { promptTokens,     |
|                                   |     completionTokens } }`                           |
| `turn_complete.totalCost`         | Final per-mission cost figure —                     |
|                                   |   `../contracts/json-api-contract.md` (line ~213):  |
|                                   |   `{ "type": "turn_complete", ..., "totalCost" }`   |
| Harness `costCap`                 | Per-mission cost ceiling default 1.0 USD —          |
|                                   |   `agent/src/adapter/inbound/api/missions/          |
|                                   |   mission.schema.ts:48` (HarnessConfigSchema)       |
| Tier model                        | free / pro tiers and planned rate limits —          |
|                                   |   `roles-and-permissions.md`                        |
+-----------------------------------+-----------------------------------------------------+

The backend already relays the SSE stream (chat/handler.go:397-525) and parses
`usage` / `turn_complete` packets in its stream loop — the capture points for
reporting already exist.

## Proposed Architecture (Design)

### Data Flow

```
┌──────────────┐  SSE stream (relay)   ┌──────────────────┐
│  Hono Agent  │──────────────────────►│  Go Backend      │
│  reports raw │  usage + totalCost    │  computes cost   │
│  usage       │                       │  persists ledger │
└──────────────┘                       │  enforces quota  │
       │                               └────────┬─────────┘
       │  POST /api/v1/internal/usage/report     │
       │  (design only — Service JWT)           ▼
       └────────────────────────────────►  usage_records (table)
```

Two reporting channels (design):

1. **Passive — SSE capture**: backend extracts token counts from the `usage`
   packets and `totalCost` from `turn_complete` it already relays. Zero agent
   changes.
2. **Active — internal endpoint**: a new
   `POST /api/v1/internal/usage/report` (Service JWT, sub "agent" — see
   `../contracts/internal-api-contract.md`) for events the SSE relay may not
   see (e.g. fire-and-forget missions). Design only — endpoint does not exist.

Backend responsibilities (design): compute cost from provider prices, persist
records, enforce per-tier quotas, and expose usage to the frontend via a
public (JWT-protected) read endpoint.

### Tier Quota Table (Draft — from roles-and-permissions.md)

Rate limiting tiers are themselves still **Planned — not implemented**; the
usage quotas below follow the same sketch.

+------+------------------+----------------------+---------------------+
| Tier | Chat RPM         | Cost cap / mission   | Monthly quota       |
+------+------------------+----------------------+---------------------+
| free | 10               | (harness costCap)    | (draft — TBD)       |
| pro  | 60               | 1.0 USD default      | (draft — TBD)       |
| admin| 200              | —                    | unlimited           |
+------+------------------+----------------------+---------------------+

## What Implementation Would Require (List — Not Built)

1. **Usage table(s)**: e.g. `usage_records` (user_id, tier_at_time,
   session_id, provider, prompt/completion tokens, cost_usd, created_at) +
   optional aggregate `usage_daily`.
2. **Internal handler + service**: `POST /api/v1/internal/usage/report` on
   the backend (Service JWT middleware, base path `/api/v1/internal`).
3. **Enforcement point in chat handler**: quota check in
   `backend/internal/handler/chat/handler.go` (alongside the tier gate at
   lines 180-195) — reject or degrade when quota exhausted.
4. **Cost computation**: per-provider price list keyed by model; the agent
   only reports tokens, the backend computes USD.
5. **Frontend display**: usage meter in `frontend/web/src/features/settings/`.
6. **Public read endpoint**: `GET /api/v1/usage` (user JWT) for the frontend.

## Non-Goals

- Not building anything now — this document records the design only.
- No provider-specific cost calculation details are defined yet (pricing
  tables, currency handling, rounding rules are TBD).
- No billing/invoicing integration (Stripe etc.) is in scope.
- No agent-side quota logic — the agent stays stateless and billing-free.

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
