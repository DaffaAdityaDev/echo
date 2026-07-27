# Governance & Change Management

Module     : LLMOps Governance
Service    : Backend / Application / Module
Version    : 1.0
Updated    : 2026-07-25

## Description

Every prompt change is versioned, auditable, and reversible by a
non-technical admin. No Git knowledge required. Part of the LLMOps
change control pipeline.

## File Structure

| Location                              | Role                            |
|---------------------------------------|---------------------------------|
| frontend/web/src/features/llmops/     | Frontend module                 |
|   governance/                         | Approval flow                   |
|   prompts/                            | Prompt versioning & history     |
| backend/internal/handler/llmops/      | governance_handler.go           |
| backend/internal/service/llmops/      | Governance business logic       |
| backend/internal/repository/llmops/   | Data access                     |
|   module/props/                       | prompt_templates, prompt_versions|

## User Persona — Governance Permissions

| Persona           | Governance (Approve) |
|-------------------|----------------------|
| Prompt Engineer   | No                   |
| Domain Expert     | No                   |
| Admin Bisnis      | Full                 |
| Product Manager   | Approve              |

## UX Flow — Governance

```
                      ┌───────────────────────────────┐
                      │         4. GOVERNANCE         │
                      │                               │
                      │  ┌──────────────────────────┐ │
                      │  │ Version │ Actor  │ Score  │ │
                      │  ├──────────────────────────┤ │
                      │  │ v1.0    │ sarah@ │ 78%   │ │
                      │  │ v1.1    │ alex@  │ 85%   │ │
                      │  │ v1.2    │ sarah@ │ 82%   │ │
                      │  │ v1.3    │ alex@  │ 92%   │ │
                      │  └──────────────────────────┘ │
                      │                               │
                      │  [Rollback] [Approve v1.3]    │
                      └───────────────────────────────┘
```

## Pillar 4 — Governance & Change Management

### Concept
Every prompt change is versioned, auditable, and reversible by a
non-technical admin. No Git knowledge required.

### Prompt Versioning (Visual Git)

| Prompt Version History (customer_support_agent)                        |
|------------------------------------------------------------------------|
| v1.0 — Initial prompt (sarah@, 78% score)                              |
| v1.1 — Added return policy instructions (alex@, 85%) — Rolled back     |
| v1.2 — Simplified tone per user feedback (sarah@, 82%) — Live          |
| v1.3 — Added escalation flow (alex@, 92%)                              |
| v1.4 — Proposed edit (unsaved)                                          |

**Diff Inspector:**
```
v1.2 ─────────────────────────────────────────────────
  "Jelaskan kebijakan retur dengan sopan."
v1.3 ─────────────────────────────────────────────────
+ "Jika user marah, tetap tenang dan tawarkan solusi."
  "Jelaskan kebijakan retur dengan sopan."
+ "Jika tidak puas, arahkan ke supervisor via tool."
```

### One-Click Rollback

- If a promoted prompt causes issues (flagged conversations spike,
  score drops), admin clicks **"Rollback to v1.2"**
- System immediately switches live traffic to the previous version


### Approval Flow

```
Prompt Engineer ──► Domain Expert ──► Admin Bisnis ──► PRODUCTION
    creates            reviews            approves
    draft
```

- Each stage can reject with reason
- Rejected prompts go back to Draft with feedback attached
- Status: Draft → In Review → Approved → Production

### States

| State          | What User Sees                                                    |
|----------------|-------------------------------------------------------------------|
| Draft          | Prompt editor, [Save as Draft], [Submit for Review]               |
| In Review      | Reviewer name, [Approve]/[Reject]                                 |
| Approved       | [Promote to Production] button, confirmation modal                |
| Production     | "Live since July 25" with rollback button                         |
| Rolled Back    | "v1.3 rolled back to v1.2 by alex@ — 2026-07-25 14:30"           |

## Architecture Integration

| Pillar        | Integration Point                                                     |
|---------------|-----------------------------------------------------------------------|
| Governance    | New tables (prompt_templates, prompt_versions). Agent reads prompt    |
|               | from DB at runtime (fallback to hardcoded prompts if no DB entry).    |

## UI Route Structure

```
/studio/prompts                   — Prompt version library
/studio/prompts/:id               — Version history + diff view
/studio/prompts/:id/versions/:v   — Specific version detail
/studio/settings                  — Evaluator model config, user prefs
```

## Phase Roadmap

| Phase | Scope                          | Dependencies                    |
|-------|--------------------------------|---------------------------------|
| 1     | Playground (single-model) +    | None                            |
|       | Prompt Versioning              |                                 |
| 3     | Approval Flow                  |                                 |

## Dependencies

- **PostgreSQL** — prompt_templates, prompt_versions

## Source References

| Reference                                    | Role                                           |
|----------------------------------------------|------------------------------------------------|
| docs/shared/architecture/headless-haas.md    | Agent harness architecture                     |
| docs/shared/patterns/observability.md        | Internal debugging (Langfuse, OTel)            |
| docs/shared/patterns/ai-ready-maturity.md    | Maturity model scoring — pushes Echo from L3   |
|                                              | to L4                                          |

---
(c) 2026 Echo — All Rights Reserved
