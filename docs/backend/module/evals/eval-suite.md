# Eval Suite — Automated Quality Gate

Module     : LLMOps Eval Suite
Service    : Backend / Application / Module
Version    : 1.0
Updated    : 2026-07-25

## Description

"School exam for AI." User uploads a test dataset, defines scoring criteria,
and the system grades the AI automatically. Part of the LLMOps quality gate
pipeline.

## File Structure

| Location                              | Role                            |
|---------------------------------------|---------------------------------|
| frontend/web/src/features/llmops/     | Frontend module                 |
|   evals/                              | Eval suite, dataset management  |
| backend/internal/handler/llmops/      | eval_handler.go                 |
| backend/internal/service/llmops/      | Eval business logic             |
| backend/internal/repository/llmops/   | Data access                     |
|   module/eval/                        | eval_datasets, eval_runs tables |

## User Persona — Eval Suite Permissions

| Persona           | Eval Suite        |
|-------------------|-------------------|
| Prompt Engineer   | Run tests         |
| Domain Expert     | Dataset prep      |
| Admin Bisnis      | View scores       |
| Product Manager   | Summary only      |

## UX Flow — Eval Suite

```
                      ┌───────────────────────────────┐
                      │         2. EVAL SUITE         │
                      │                               │
                      │  Upload Dataset: 50 test cases │
                      │  ┌──────────────────────────┐ │
                      │  │ Rule-Based:              │ │
                      │  │  ☑ No competitor names   │ │
                      │  │  ☑ Max 3 paragraphs      │ │
                      │  │  ☑ Must call tool if     │ │
                      │  │     stock question        │ │
                      │  ├──────────────────────────┤ │
                      │  │ LLM-as-a-Judge (rubric):  │ │
                      │  │  • Accuracy (40%)        │ │
                      │  │  • Format compliance(30%)│ │
                      │  │  • Tool correctness(30%) │ │
                      │  └──────────────────────────┘ │
                      │                               │
                      │  [Run Eval Suite] → Score:    │
                      │  88% Pass Rate                │
                      └───────────────────────────────┘
```

## Pillar 2 — Eval Suite

### Concept
"School exam for AI." User uploads a test dataset, defines scoring criteria,
and the system grades the AI automatically.

### Two Evaluation Layers

**A. Rule-Based Assertions (Hard Rules)**
Failed rules block promotion entirely. Defined via UI toggles and inputs:

| Rule Type           | Example                              | UX Control                  |
|---------------------|--------------------------------------|-----------------------------|
| Forbidden keywords  | "Cannot mention competitor X"        | Text input (comma-separated)|
| Max length          | "Max 3 paragraphs"                   | Slider + preview            |
| Mandatory tool call | "Must call search if stock asked"    | Dropdown + condition builder|
| JSON schema         | "Output must match {product, price}" | Schema builder UI           |

**B. LLM-as-a-Judge (Semantic Scoring)**
Uses an evaluator LLM with a user-defined rubric:

| Criteria           | Default Weight | Description                            |
|--------------------|----------------|----------------------------------------|
| Accuracy           | 40%            | Does the answer match ground truth?    |
| Format compliance  | 30%            | Does response follow instructed style? |
| Tool correctness   | 30%            | Are tools called at the right time?    |

### Dataset Management

- Upload CSV with columns `[input, expected_output]`
- Or use historical flagged conversations (from Shadow Testing)
- Run against any prompt version
- Score report: pass rate %, per-criteria breakdown, failing cases list

### States

| State          | What User Sees                                                    |
|----------------|-------------------------------------------------------------------|
| No dataset     | Upload area: "Drag CSV or select from flagged conversations"      |
| Dataset loaded | Preview table (first 5 rows), row count, [Run Eval Suite]         |
| Running        | Progress bar: "Evaluating 23/50 test cases..."                    |
| Complete       | Score card: "88% Pass Rate" with per-criteria breakdown           |
| Failure detail | Expandable list of failed cases with AI output vs expected        |
| Empty result   | "No test cases matched your rules — all passed"                   |

## Architecture Integration

| Pillar     | Integration Point                                                     |
|------------|-----------------------------------------------------------------------|
| Eval Suite | Reuses harness + providers. Eval judge uses a separate evaluator      |
|            | model (configurable). Stores results in eval_runs table.              |

## UI Route Structure

```
/studio/evals                     — Eval suite dashboard
/studio/evals/:run_id             — Single eval run detail
/studio/evals/datasets            — Dataset management
```

## Phase Roadmap

| Phase | Scope                          | Dependencies                    |
|-------|--------------------------------|---------------------------------|
| 2     | Eval Suite (rule-based +       | Needs Playground for test       |
|       | LLM-as-a-Judge)                | execution; Needs evaluator LLM  |
|       |                                | config                          |

## Dependencies

- **Existing LLM providers** — reused for test execution and eval judging
- **Existing agent harness** — reused, with prompt override from DB
- **PostgreSQL** — eval_runs, eval_datasets tables
- **Playground** — test execution engine

## Source References

| Reference                                    | Role                                           |
|----------------------------------------------|------------------------------------------------|
| docs/shared/architecture/headless-haas.md    | Agent harness architecture reused by Eval Suite|
| docs/shared/patterns/observability.md        | Internal debugging (Langfuse, OTel)            |
| docs/shared/patterns/ai-ready-maturity.md    | Maturity model scoring — pushes Echo from L3   |
|                                              | to L4                                          |

---
(c) 2026 Echo — All Rights Reserved
