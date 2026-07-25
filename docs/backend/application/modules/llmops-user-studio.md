================================================================================
  LLMOPS USER STUDIO
================================================================================
  Module    : LLMOps User Studio
  Service   : Backend / Application / Modules
  Version   : 1.0
  Updated   : 2026-07-25
================================================================================

## Description

User-facing LLMOps engine that empowers non-technical users (admin bisnis,
prompt engineer, domain expert) to test, evaluate, and audit AI behaviour
without reading raw JSON logs or touching code.

Four interconnected pillars:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         LLMOPS USER STUDIO                                │
├─────────────────┬──────────────────┬──────────────────┬───────────────────┤
│ 1. Playground   │ 2. Eval Suite    │ 3. Shadow Test   │ 4. Governance    │
│ (Sandbox)       │ (Quality Gate)   │ (Production)     │ (Change Control) │
└─────────────────┴──────────────────┴──────────────────┴───────────────────┘
```

Designed as a standalone module — not bolted onto chat. Serves as the primary
interface for non-developers to own their AI behaviour.

---

## File Structure

+--------------------------------------+------------------------------------------+
| Location                             | Role                                     |
+--------------------------------------+------------------------------------------+
| frontend/web/src/features/llmops/    | Frontend module — all 4 pillars          |
|   studio/                            | Multi-model playground UI                |
|   evals/                             | Eval suite, dataset management           |
|   prompts/                           | Prompt versioning & history              |
|   shadow/                            | Shadow test dashboard                    |
|   governance/                        | Approval flow, audit ledger              |
| backend/internal/handler/llmops/     | HTTP handlers per pillar                 |
| backend/internal/service/llmops/     | Business logic, orchestration            |
| backend/internal/repository/llmops/  | Module dispatcher (empty — delegates     |
|                                     |   to sub-modules below)                 |
| backend/internal/repository/llmops/  | Data access per domain:                  |
|   module/audit/                      |   audit_logs table                      |
|   module/eval/                       |   eval_datasets, eval_runs tables       |
|   module/props/                      |   prompt_templates, prompt_versions     |
|   module/shadow/                     |   shadow_runs table                     |
+--------------------------------------+------------------------------------------+

---

## User Persona & Permission Matrix

+-------------------+------------+---------+---------+------------+----------+
| Persona           | Playground | Eval    | Shadow  | Governance | Audit    |
|                   |            | Suite   | Test    | (Approve)  | View     |
+-------------------+------------+---------+---------+------------+----------+
| Prompt Engineer   | Full       | Run     | View    | No         | View     |
|                   |            | tests   | only    |            |          |
+-------------------+------------+---------+---------+------------+----------+
| Domain Expert     | Create     | Dataset | View    | No         | View     |
|                   | scenarios  | prep    | only    |            |          |
+-------------------+------------+---------+---------+------------+----------+
| Admin Bisnis      | View       | View    | Promote | Full       | Full     |
|                   |            | scores  | Rollback|            |          |
+-------------------+------------+---------+---------+------------+----------+
| Product Manager   | No         | Summary | Approve | Approve    | Full     |
|                   |            | only    | promote |            |          |
+-------------------+------------+---------+---------+------------+----------+

---

## UX Flow — User Journey

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
               └───────────────────────────────────────────┘   │
                                                               │
                      ┌────────────────────────────────────────┘
                      ▼
               ┌───────────────────────────────────────────────┐
               │         2. EVAL SUITE                         │
               │                                               │
               │  Upload Dataset: 50 test cases                 │
               │  ┌──────────────────────────────────────────┐ │
               │  │ Rule-Based:                              │ │
               │  │  ☑ No competitor names                   │ │
               │  │  ☑ Max 3 paragraphs                      │ │
               │  │  ☑ Must call tool if stock question      │ │
               │  ├──────────────────────────────────────────┤ │
               │  │ LLM-as-a-Judge (rubric):                  │ │
               │  │  • Accuracy (40%)                        │ │
               │  │  • Format compliance (30%)               │ │
               │  │  • Tool correctness (30%)                │ │
               │  └──────────────────────────────────────────┘ │
               │                                               │
               │  [Run Eval Suite] → Score: 88% Pass Rate      │
               └───────────────────────────────────────────────┘
                                                               │
                      ┌────────────────────────────────────────┘
                      ▼
               ┌───────────────────────────────────────────────┐
               │         3. SHADOW TEST (Production)           │
               │                                               │
               │  5% traffic mirrored to candidate version      │
               │                                               │
               │  ┌──────────────────────────────────────────┐ │
               │  │ v1.2 (live)    vs    v1.3 (candidate)    │ │
               │  │ 82% score      │    92% score ▲          │ │
               │  │ $0.04/req      │    $0.03/req ▼          │ │
               │  └──────────────────────────────────────────┘ │
               │                                               │
               │  [Promote to Production]  [Discard]           │
               └───────────────────────────────────────────────┘
                                                               │
                      ┌────────────────────────────────────────┘
                      ▼
               ┌───────────────────────────────────────────────┐
               │         4. GOVERNANCE                         │
               │                                               │
               │  ┌──────────────────────────────────────────┐ │
               │  │ Version  │ Actor    │ Score  │ Status    │ │
               │  ├──────────────────────────────────────────┤ │
               │  │ v1.0     │ sarah@   │ 78%    │ Production│ │
               │  │ v1.1     │ alex@    │ 85%    │ Rollback  │ │
               │  │ v1.2     │ sarah@   │ 82%    │ Live      │ │
               │  │ v1.3     │ alex@    │ 92%    │ Pending   │ │
               │  └──────────────────────────────────────────┘ │
               │                                               │
               │  Actions: [Rollback to v1.2] [Approve v1.3]   │
               └───────────────────────────────────────────────┘
```

---

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

| State | What User Sees |
|-------|---------------|
| Empty | Prompt editor with variable slots, model selector, [Test] button |
| Running | Loading spinners per model column, streaming text appearing |
| Complete | Side-by-side responses with diff highlights, token usage per model |
| Error | Per-model error card: "Model timed out" / "Rate limited" with retry |
| Comparison | Highlighted differences between model outputs (green/red) |

---

## Pillar 2 — Eval Suite (Automated Quality Gate)

### Concept
"School exam for AI." User uploads a test dataset, defines scoring criteria,
and the system grades the AI automatically.

### Two Evaluation Layers

**A. Rule-Based Assertions (Hard Rules)**
Failed rules block promotion entirely. Defined via UI toggles and inputs:

| Rule Type | Example | UX Control |
|-----------|---------|-----------|
| Forbidden keywords | "Cannot mention competitor X" | Text input (comma-separated) |
| Max length | "Max 3 paragraphs" | Slider + preview |
| Mandatory tool call | "Must call search if stock asked" | Dropdown + condition builder |
| JSON schema | "Output must match {product, price}" | Schema builder UI |

**B. LLM-as-a-Judge (Semantic Scoring)**
Uses an evaluator LLM with a user-defined rubric:

| Criteria | Default Weight | Description |
|----------|---------------|-------------|
| Accuracy | 40% | Does the answer match ground truth? |
| Format compliance | 30% | Does response follow instructed tone/style? |
| Tool correctness | 30% | Are tools called at the right time? |

### Dataset Management

- Upload CSV with columns `[input, expected_output]`
- Or use historical flagged conversations (from Pillar 3)
- Run against any prompt version
- Score report: pass rate %, per-criteria breakdown, failing cases list

### States

| State | What User Sees |
|-------|---------------|
| No dataset | Upload area: "Drag CSV or select from flagged conversations" |
| Dataset loaded | Preview table (first 5 rows), row count, [Run Eval Suite] |
| Running | Progress bar: "Evaluating 23/50 test cases..." |
| Complete | Score card: "88% Pass Rate" with per-criteria breakdown |
| Failure detail | Expandable list of failed cases with AI output vs expected |
| Empty result | "No test cases matched your rules — all passed" |

---

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

| State | What User Sees |
|-------|---------------|
| Idle | Shadow toggle: off / 1% / 5% / 10% |
| Active | Live dashboard: "1,230 shadow runs collected, 45 flagged" |
| Comparison | Side-by-side table: v1.2 vs v1.3 with scores, cost, latency |
| Alert | Safety alert card: "12 injection attempts blocked today" |
| Promote ready | [Promote to Production] button active with confidence score |

---

## Pillar 4 — Governance & Change Management

### Concept
Every prompt change is versioned, auditable, and reversible by a
non-technical admin. No Git knowledge required.

### Prompt Versioning (Visual Git)

| Prompt Version History (customer_support_agent) |
|-------------------------------------------------|
| v1.0 — Initial prompt (sarah@, 78% score)       |
| v1.1 — Added return policy instructions (alex@, 85%) — Rolled back |
| v1.2 — Simplified tone per user feedback (sarah@, 82%) — Live |
| v1.3 — Added escalation flow (alex@, 92%) — Shadow testing |
| v1.4 — Proposed edit (unsaved)                    |

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
- Full audit trail: who rolled back, when, why

### Approval Flow

```
Prompt Engineer ──► Domain Expert ──► Admin Bisnis ──► PRODUCTION
    creates            reviews            approves
    draft              dataset score      shadow results
```

- Each stage can reject with reason
- Rejected prompts go back to Draft with feedback attached
- Status: Draft → In Review → Shadow Testing → Approved → Production

### States

| State | What User Sees |
|-------|---------------|
| Draft | Prompt editor, [Save as Draft], [Submit for Review] |
| In Review | Reviewer name, Eval score badge, [Approve]/[Reject] |
| Shadow Testing | "Running on 5% of traffic" with live score comparison |
| Approved | [Promote to Production] button, confirmation modal |
| Production | "Live since July 25" with rollback button |
| Rolled Back | "v1.3 rolled back to v1.2 by alex@ — 2026-07-25 14:30" |
| Failed | "Shadow score dropped 15%, auto-cancelled" |

---

## Architecture Integration Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND /studio/*                            │
│  /studio/playground  /studio/evals  /studio/prompts  /studio/audit   │
│         │                │               │               │           │
└─────────┼────────────────┼───────────────┼───────────────┼───────────┘
          │                │               │               │
          ▼                ▼               ▼               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     GO BACKEND — llmops/ handlers                     │
│                                                                      │
│  studio_handler.go   eval_handler.go   prompt_handler.go             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐     │
│  │ Run test     │   │ Run eval     │   │ CRUD prompt versions │     │
│  │ against LLM  │   │ against      │   │ Diff, rollback,      │     │
│  │ providers    │   │ dataset      │   │ approval workflow    │     │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘     │
└─────────┼──────────────────┼──────────────────────┼──────────────────┘
          │                  │                      │
          ▼                  ▼                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    EXISTING INFRASTRUCTURE                            │
│                                                                      │
│  ┌────────────┐   ┌──────────────┐   ┌────────────────────────┐     │
│  │ Agent      │   │ LLM          │   │ PostgreSQL              │     │
│  │ Harness    │   │ Providers    │   │ prompt_templates        │     │
│  │ (reuse)    │   │ (reuse)      │   │ prompt_versions         │     │
│  │            │   │              │   │ eval_runs               │     │
│  │ Shadow:    │   │ Eval:        │   │ eval_datasets           │     │
│  │ parallel   │   │ judge LLM    │   │ audit_log               │     │
│  │ execution  │   │ separate cfg │   │ prompt_diffs            │     │
│  └────────────┘   └──────────────┘   └────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

### How Each Pillar Hooks Into Existing System

+----------------+--------------------------------------------------------+
| Pillar         | Integration Point                                      |
+----------------+--------------------------------------------------------+
| Playground     | Calls existing LLM providers via harness, but with     |
|                | mock/override variables. No persistence.               |
+----------------+--------------------------------------------------------+
| Eval Suite     | Reuses harness + providers. Eval judge uses a          |
|                | separate evaluator model (configurable). Stores        |
|                | results in eval_runs table.                            |
+----------------+--------------------------------------------------------+
| Shadow Test    | Intercepts chat_handler.go mission pipeline.           |
|                | Fork: live path = existing flow, shadow path =         |
|                | candidate prompt version (async, stored only).         |
+----------------+--------------------------------------------------------+
| Governance     | New tables (prompt_templates, prompt_versions).        |
|                | Agent reads prompt from DB at runtime (fallback to     |
|                | hardcoded prompts if no DB entry).                    |
+----------------+--------------------------------------------------------+

---

## UI Route Structure

```
/studio                           — Dashboard (overview of all pillars)
/studio/playground                — Multi-model test lab
/studio/playground/:prompt_id     — Load existing draft
/studio/evals                     — Eval suite dashboard
/studio/evals/:run_id             — Single eval run detail
/studio/evals/datasets            — Dataset management
/studio/prompts                   — Prompt version library
/studio/prompts/:id               — Version history + diff view
/studio/prompts/:id/versions/:v   — Specific version detail
/studio/shadow                    — Shadow test dashboard
/studio/shadow/:run_id            — Comparison detail
/studio/audit                     — Audit inbox + flagged conversations
/studio/audit/safety              — Safety alert dashboard
/studio/settings                  — Evaluator model config, user prefs
```

---

## Phase Roadmap

+--------+---------------------------+----------------------------------------+
| Phase  | Scope                    | Dependencies                           |
+--------+---------------------------+----------------------------------------+
| 1      | Playground (single-      | None — standalone frontend + backend   |
|        | model) + Prompt          | calls existing LLM providers           |
|        | Versioning               |                                        |
+--------+---------------------------+----------------------------------------+
| 2      | Eval Suite (rule-based   | Needs Playground for test execution    |
|        | + LLM-as-a-Judge)        | Needs evaluator LLM config             |
+--------+---------------------------+----------------------------------------+
| 3      | Shadow Testing +         | Needs Eval Suite for scoring           |
|        | Approval Flow            | Needs chat_handler interceptor         |
+--------+---------------------------+----------------------------------------+
| 4      | Safety alerts, Human-    | Needs Shadow for traffic data          |
|        | in-the-loop, Audit       | Needs Governance for version context   |
|        | Inbox                    |                                        |
+--------+---------------------------+----------------------------------------+

---

## Entry Points & Exports

- **Module index**: `docs/backend/application/modules/README.md`
- **Related patterns**: `docs/shared/patterns/ai-ready-maturity.md`
  (this module targets L3-L4 maturity)
- **Related patterns**: `docs/shared/patterns/observability.md`
  (existing OTel/Langfuse tracing for internal debugging)
- **Related patterns**: `docs/shared/architecture/headless-haas.md`
  (agent execution architecture reused by Playground)

## Dependencies

- **Existing LLM providers** — reused for test execution and eval judging
- **Existing agent harness** — reused, with prompt override from DB
- **PostgreSQL** — new tables for prompt versions, eval runs, datasets
- **Frontend** — new `/studio/*` route tree, independent from chat

## Source References

+------------------------------------------+--------------------------------------+
| Reference                                | Role                                 |
+------------------------------------------+--------------------------------------+
| docs/shared/architecture/headless-       | Agent harness architecture reused    |
| haas.md                                  | by Playground                        |
+------------------------------------------+--------------------------------------+
| docs/shared/patterns/observability.md    | Internal debugging (Langfuse, OTel)  |
|                                          | — separate from user-facing LLMOps   |
+------------------------------------------+--------------------------------------+
| docs/shared/patterns/ai-ready-           | Maturity model scoring — this module |
| maturity.md                              | pushes Echo from L3 to L4           |
+------------------------------------------+--------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
