# Shadow Testing & Production Audit

Module     : LLMOps Shadow Testing
Service    : Backend / Application / Module
Version    : 1.0
Updated    : 2026-07-25

## Description

Test new prompts against real production traffic without affecting end-users.
Candidate version runs silently in the background alongside the live version.
Part of the LLMOps production safety pipeline.

## File Structure

| Location                              | Role                            |
|---------------------------------------|---------------------------------|
| frontend/web/src/features/llmops/     | Frontend module                 |
|   shadow/                             | Shadow test dashboard           |
| backend/internal/handler/llmops/      | shadow_handler.go               |
| backend/internal/service/llmops/      | Shadow test business logic      |
| backend/internal/repository/llmops/   | Data access                     |
|   module/shadow/                      | shadow_runs table               |

## User Persona — Shadow Test Permissions

| Persona           | Shadow Test       |
|-------------------|-------------------|
| Prompt Engineer   | View only         |
| Domain Expert     | View only         |
| Admin Bisnis      | Promote / Rollback|
| Product Manager   | Approve promote   |

## UX Flow — Shadow Testing

```
                      ┌───────────────────────────────┐
                      │         3. SHADOW TEST        │
                      │                               │
                      │  5% traffic mirrored to       │
                      │  candidate version            │
                      │                               │
                      │  ┌──────────────────────────┐ │
                      │  │ v1.2 (live) vs v1.3      │ │
                      │  │              (candidate) │ │
                      │  │ 82% score    92% score ▲ │ │
                      │  │ $0.04/req   $0.03/req ▼  │ │
                      │  └──────────────────────────┘ │
                      │                               │
                      │  [Promote] [Discard]           │
                      └───────────────────────────────┘
```

## Pillar 3 — Shadow Testing & Production Audit

### Concept
Test new prompts against real production traffic without affecting
end-users. Candidate version runs silently in the background alongside
the live version.

### Traffic Mirroring Flow

```
User Request
    │
    ├──► Live Prompt v1.2 ───► Response to User (fast path)
    │
    └──► Shadow Prompt v1.3 ───► Stored in eval_runs (async)
                                 (user never waits for this)
```

- Configurable mirror %: 1%, 5%, 10% of traffic
- Candidate responses never reach the user — stored for comparison only
- Comparison dashboard shows: score delta, token cost delta, latency delta

### Flagging & Human-in-the-Loop

- End-user thumbs down / report → auto-inserted into "Audit Inbox"
- Audit inbox: list of flagged conversations tied to the prompt version
  that generated them
- Admin can mark as "investigate", "false alarm", or "add to dataset"

### Safety Alerts

- Dashboard for detected prompt injection / jailbreak attempts
- Shows: attack vector, whether guardrails blocked it, timestamp, frequency
- Trend graph: "Injection attempts this week: +23%"

### States

| State         | What User Sees                                                     |
|---------------|--------------------------------------------------------------------|
| Idle          | Shadow toggle: off / 1% / 5% / 10%                                 |
| Active        | Live dashboard: "1,230 shadow runs collected, 45 flagged"          |
| Comparison    | Side-by-side table: v1.2 vs v1.3 with scores, cost, latency        |
| Alert         | Safety alert card: "12 injection attempts blocked today"           |
| Promote ready | [Promote to Production] button active with confidence score        |

## Architecture Integration

| Pillar        | Integration Point                                                     |
|---------------|-----------------------------------------------------------------------|
| Shadow Test   | Intercepts chat_handler.go mission pipeline. Fork: live path =        |
|               | existing flow, shadow path = candidate prompt version (async, stored  |
|               | only).                                                                |

## UI Route Structure

```
/studio/shadow                    — Shadow test dashboard
/studio/shadow/:run_id            — Comparison detail
/studio/audit                     — Audit inbox + flagged conversations
/studio/audit/safety              — Safety alert dashboard
```

## Phase Roadmap

| Phase | Scope                          | Dependencies                    |
|-------|--------------------------------|---------------------------------|
| 3     | Shadow Testing + Approval Flow | Needs Eval Suite for scoring;   |
|       |                                | Needs chat_handler interceptor  |

## Dependencies

- **Existing LLM providers** — reused for candidate evaluation
- **Existing agent harness** — reused, with prompt override
- **PostgreSQL** — shadow_runs table
- **Eval Suite** — scoring of candidate vs live
- **Chat handler interceptor** — traffic mirroring fork point

## Source References

| Reference                                    | Role                                           |
|----------------------------------------------|------------------------------------------------|
| docs/shared/architecture/headless-haas.md    | Agent harness architecture reused by Shadow    |
| docs/shared/patterns/observability.md        | Internal debugging (Langfuse, OTel)            |
| docs/shared/patterns/ai-ready-maturity.md    | Maturity model scoring — pushes Echo from L3   |
|                                              | to L4                                          |

---
(c) 2026 Echo — All Rights Reserved
