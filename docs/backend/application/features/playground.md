# Playground & Sandbox

Module     : LLMOps Playground
Service    : Backend / Application / Module
Version    : 1.0
Updated    : 2026-07-25

## Description

User-facing sandbox that empowers non-technical users (admin bisnis, prompt
engineer, domain expert) to test AI ideas before releasing to end-users.
No code, no raw JSON, no terminal.

Same prompt executed across multiple models simultaneously with side-by-side
comparison, mock variables, and visual tool inspector.

## File Structure

| Location                              | Role                            |
|---------------------------------------|---------------------------------|
| frontend/web/src/features/llmops/     | Frontend module                 |
|   studio/                             | Multi-model playground UI       |
| backend/internal/handler/llmops/      | studio_handler.go               |
| backend/internal/service/llmops/      | Playground business logic       |
| backend/internal/repository/llmops/   | Data access (module/props/)     |

## User Persona — Playground Permissions

| Persona           | Playground      |
|-------------------|-----------------|
| Prompt Engineer   | Full            |
| Domain Expert     | Create scenarios|
| Admin Bisnis      | View            |
| Product Manager   | No              |

## UX Flow — Playground

```
                                          ┌──────────────────────┐
                                          │   DRAFT PROMPT      │
                                          │   (unsaved changes) │
                                          └──────────┬───────────┘
                                                     │
                                                     ▼
             ┌───────────────────────────────────────────────┐
             │         1. PLAYGROUND                         │
             │                                               │
             │  ┌──────────────────┐  ┌──────────────────┐   │
             │  │ System Prompt    │  │ Variable Mock     │   │
             │  │ (editor + vars)  │  │ ┌──────────────┐ │   │
             │  │                  │  │ │{{user_query}} │ │   │
             │  │ [Test Prompt]    │  │ │{{knowledge}}  │ │   │
             │  └────────┬─────────┘  │ │mock: "cemana │ │   │
             │           │            │ │  cara retur?" │ │   │
             │           ▼            │ └──────────────┘ │   │
             │  ┌─────────────────────────────────────┐  │   │
             │  │ Side-by-Side Comparison              │  │   │
             │  │ ┌──────────┬──────────┬──────────┐  │  │   │
             │  │ │ GPT-4o   │ Claude   │ Local    │  │  │   │
             │  │ │ "Maaf.." │ "Halo!   │ "Retur.."│  │  │   │
             │  │ │           │  silakan"│           │  │  │   │
             │  │ └──────────┴──────────┴──────────┘  │  │   │
             │  └─────────────────────────────────────┘  │   │
             └───────────────────────────────────────────┘
```

## Pillar 1 — Playground & Sandbox

### Concept
A "laboratory" where non-technical users test AI ideas before releasing
to end-users. No code, no raw JSON, no terminal.

### Key Features

**Multi-Model Battleground**
- Same prompt executed across 3 models simultaneously (e.g. GPT-4o vs
  Claude 3.5 vs Local Model)
- Side-by-side comparison in a single view
- Highlight differences in tone, accuracy, tool usage

**Simulation & Mocking**
- Mock variables: `{{user_query}}`, `{{knowledge_context}}`, `{{history}}`
- Pre-built personas: angry user, slang speaker, prompt injection attempt
- Simulated tool results (e.g. mock stock API returning "out of stock")

**Visual Tool Inspector**
- Renders the agent's thinking as a visual flowchart, not JSON logs
- Example: `Think → Search Inventory → Calculate Discount → Respond`
- Each step expandable to see details, but hidden by default for clarity

### States

| State    | What User Sees                                                    |
|----------|-------------------------------------------------------------------|
| Empty    | Prompt editor with variable slots, model selector, [Test] button  |
| Running  | Loading spinners per model column, streaming text appearing        |
| Complete | Side-by-side responses with diff highlights, token usage per model |
| Error    | Per-model error card: "Model timed out" / "Rate limited" with retry|
| Comparison | Highlighted differences between model outputs (green/red)        |

## Architecture Integration

| Pillar     | Integration Point                                                     |
|------------|-----------------------------------------------------------------------|
| Playground | Calls existing LLM providers via harness, but with mock/override      |
|            | variables. No persistence.                                            |

## UI Route Structure

```
/studio/playground                — Multi-model test lab
/studio/playground/:prompt_id     — Load existing draft
```

## Phase Roadmap

| Phase | Scope                          | Dependencies                    |
|-------|--------------------------------|---------------------------------|
| 1     | Playground (single-model)      | None — standalone frontend +    |
|       | + Prompt Versioning            | backend calls existing LLM      |
|       |                                | providers                       |

## Dependencies

- **Existing LLM providers** — reused for test execution
- **Existing agent harness** — reused, with prompt override from DB
- **PostgreSQL** — prompt_templates, prompt_versions tables
- **Frontend** — /studio/playground route, independent from chat

## Source References

| Reference                                    | Role                                           |
|----------------------------------------------|------------------------------------------------|
| docs/shared/architecture/headless-haas.md    | Agent harness architecture reused by Playground|
| docs/shared/patterns/observability.md        | Internal debugging (Langfuse, OTel)            |
| docs/shared/patterns/ai-ready-maturity.md    | Maturity model scoring — pushes Echo from L3   |
|                                              | to L4                                          |

---
(c) 2026 Echo — All Rights Reserved
