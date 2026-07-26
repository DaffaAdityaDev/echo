===============================================================================
  Studio Feature (LLMOps)
===============================================================================
  Module    : Studio Feature
  Service   : Web
  Version   : 1.0
  Updated   : 2026-07-25
===============================================================================

## Deskripsi

The AI Studio feature — an LLMOps workbench for managing prompts, running evaluations, A/B shadow testing, playground experimentation, AI-readiness maturity assessment, and audit logging. Provides tools for prompt engineers, domain experts, and product managers to govern AI behavior through structured contracts.

## File Structure

```
src/features/studio/
├── constants.ts
├── index.ts
├── data/
│   └── maturity-data.ts
├── api/
│   ├── useAudit.ts
│   ├── useEvals.ts
│   ├── useMaturity.ts
│   ├── usePrompts.ts
│   └── useShadow.ts
├── hooks/
│   ├── useAuditTrail.ts
│   ├── useEvalSuite.ts
│   ├── useMaturityModel.ts
│   ├── usePlayground.ts
│   ├── usePromptLibrary.ts
│   ├── useShadowTest.ts
│   └── useStudioDashboard.ts
├── stores/
│   └── studioStore.ts
├── components/
│   ├── dashboard/
│   │   └── StudioDashboard.tsx
│   ├── shared/
│   │   ├── EmptyState.tsx
│   │   └── JsonViewer.tsx
│   ├── prompts/
│   │   ├── PromptsPage.tsx
│   │   ├── PromptLibrary.tsx
│   │   ├── PromptVersionTimeline.tsx
│   │   ├── VersionDiffViewer.tsx
│   │   └── VersionStatusBadge.tsx
│   ├── playground/
│   │   ├── PlaygroundPage.tsx
│   │   ├── PromptEditor.tsx
│   │   └── ModelComparisonGrid.tsx
│   ├── evals/
│   │   ├── EvalDashboard.tsx
│   │   ├── DatasetUploader.tsx
│   │   └── EvalScoreCard.tsx
│   ├── shadow/
│   │   ├── ShadowDashboard.tsx
│   │   ├── ShadowComparisonTable.tsx
│   │   └── ShadowTrafficSlider.tsx
│   ├── maturity/
│   │   ├── MaturityDashboard.tsx
│   │   ├── MaturityMatrix.tsx
│   │   ├── MaturityRoadmap.tsx
│   │   └── MaturityScoringGuide.tsx
│   └── audit/
│       └── AuditTrailTable.tsx
└── types/
    └── index.ts
```

## Flow Diagrams

### Component Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                       StudioDashboard (orchestrator)                      │
│                                                                           │
│  ┌──────────────────┐   ┌────────────────────────────────────────────┐   │
│  │   Summary Cards   │   │        Sub-feature Navigation Tabs         │   │
│  │  prompt/eval/     │   │  Prompts │ Playground │ Evals │ Shadow │  │   │
│  │  shadow/audit     │   │  Maturity │ Audit                         │   │
│  │  counts + level   │   └────────────────────────────────────────────┘   │
│  └──────────────────┘                                                    │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  PromptsPage                               PlaygroundPage                 │
│  ┌────────────────────────┐               ┌─────────────────────────┐    │
│  │  PromptLibrary         │               │  PromptEditor           │    │
│  │  (list + CRUD)         │               │  (template + variables) │    │
│  │  ┌──────────────────┐  │               ├─────────────────────────┤    │
│  │  │ VersionTimeline  │  │               │  ModelComparisonGrid    │    │
│  │  │ + DiffViewer     │  │               │  (side-by-side results) │    │
│  │  │ + StatusBadge    │  │               └─────────────────────────┘    │
│  │  └──────────────────┘  │                                             │
│  └────────────────────────┘                                             │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  EvalDashboard                            ShadowDashboard                │
│  ┌────────────────────────┐               ┌─────────────────────────┐    │
│  │  DatasetUploader       │               │  ShadowComparisonTable  │    │
│  │  (upload test cases)   │               │  (live vs candidate)    │    │
│  ├────────────────────────┤               ├─────────────────────────┤    │
│  │  EvalScoreCard         │               │  ShadowTrafficSlider    │    │
│  │  (accuracy/format/     │               │  (traffic % control)    │    │
│  │   tools breakdown)     │               └─────────────────────────┘    │
│  └────────────────────────┘                                             │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  MaturityDashboard                          AuditTrailTable              │
│  ┌────────────────────────┐               ┌─────────────────────────┐    │
│  │  MaturityMatrix        │               │  Audit log table with   │    │
│  │  (7 dimensions x L1-5) │               │  actor/action/resource  │    │
│  ├────────────────────────┤               │  + payload viewer       │    │
│  │  MaturityRoadmap       │               └─────────────────────────┘    │
│  │  (7 roadmap items)     │                                             │
│  ├────────────────────────┤                                             │
│  │  MaturityScoringGuide  │                                             │
│  │  (13 scoring questions)│                                             │
│  └────────────────────────┘                                             │
└───────────────────────────────────────────────────────────────────────────┘
```

## Entry Points & Exports

### Barrel (`src/features/studio/index.ts`)

+----------------------------+-------------+------------------------------------------------------+
| Export                     | Kind        | Source                                               |
+----------------------------+-------------+------------------------------------------------------+
| StudioDashboard            | Component   | components/dashboard/StudioDashboard.tsx              |
| EmptyState                 | Component   | components/shared/EmptyState.tsx                      |
| JsonViewer                 | Component   | components/shared/JsonViewer.tsx                      |
| MaturityDashboard          | Component   | components/maturity/MaturityDashboard.tsx             |
| MaturityMatrix             | Component   | components/maturity/MaturityMatrix.tsx                |
| MaturityRoadmap            | Component   | components/maturity/MaturityRoadmap.tsx               |
| MaturityScoringGuide       | Component   | components/maturity/MaturityScoringGuide.tsx          |
| PromptsPage                | Component   | components/prompts/PromptsPage.tsx                    |
| PromptLibrary              | Component   | components/prompts/PromptLibrary.tsx                  |
| PromptVersionTimeline      | Component   | components/prompts/PromptVersionTimeline.tsx          |
| VersionDiffViewer          | Component   | components/prompts/VersionDiffViewer.tsx              |
| VersionStatusBadge         | Component   | components/prompts/VersionStatusBadge.tsx             |
| PlaygroundPage             | Component   | components/playground/PlaygroundPage.tsx              |
| PromptEditor               | Component   | components/playground/PromptEditor.tsx                |
| ModelComparisonGrid        | Component   | components/playground/ModelComparisonGrid.tsx         |
| EvalDashboard              | Component   | components/evals/EvalDashboard.tsx                    |
| DatasetUploader            | Component   | components/evals/DatasetUploader.tsx                  |
| EvalScoreCard              | Component   | components/evals/EvalScoreCard.tsx                    |
| ShadowDashboard            | Component   | components/shadow/ShadowDashboard.tsx                 |
| ShadowComparisonTable      | Component   | components/shadow/ShadowComparisonTable.tsx           |
| ShadowTrafficSlider        | Component   | components/shadow/ShadowTrafficSlider.tsx             |
| AuditTrailTable            | Component   | components/audit/AuditTrailTable.tsx                  |
| useStudioDashboard         | Hook        | hooks/useStudioDashboard.ts                           |
| useMaturityModel           | Hook        | hooks/useMaturityModel.ts                             |
| usePlayground              | Hook        | hooks/usePlayground.ts                                |
| useEvalSuite               | Hook        | hooks/useEvalSuite.ts                                 |
| usePromptLibrary           | Hook        | hooks/usePromptLibrary.ts                             |
| useShadowTest              | Hook        | hooks/useShadowTest.ts                                |
| useAuditTrail              | Hook        | hooks/useAuditTrail.ts                                |
| all types                  | Type        | types/index.ts                                        |
+----------------------------+-------------+------------------------------------------------------+

> **Note:** `api/`, `stores/`, `constants.ts`, and `data/` are internal — not re-exported from the barrel.

### Components

+-----------------------+--------------------------------------------------------------+
| Component             | Description                                                  |
+-----------------------+--------------------------------------------------------------+
| StudioDashboard       | Overview page — prompt/eval/shadow/audit counts, maturity    |
|                       | level, weakest dimension, roadmap progress. Props: all       |
|                       | data from useStudioDashboard.                                |
+-----------------------+--------------------------------------------------------------+
| PromptsPage           | Full prompt management page with library + version timeline. |
+-----------------------+--------------------------------------------------------------+
| PromptLibrary         | List of prompt templates with create/new-version actions.    |
+-----------------------+--------------------------------------------------------------+
| PromptVersionTimeline | Vertical timeline of versions for a selected template.       |
+-----------------------+--------------------------------------------------------------+
| VersionDiffViewer     | Side-by-side diff between two prompt versions.               |
+-----------------------+--------------------------------------------------------------+
| VersionStatusBadge    | Colored badge: draft, in_review, shadow, approved,           |
|                       | production, rolled_back.                                     |
+-----------------------+--------------------------------------------------------------+
| PlaygroundPage        | Interactive prompt editor with multi-model comparison.       |
+-----------------------+--------------------------------------------------------------+
| PromptEditor          | Textarea with variable interpolation fields.                 |
+-----------------------+--------------------------------------------------------------+
| ModelComparisonGrid   | Grid of model outputs (content, latency, tokens, errors).    |
+-----------------------+--------------------------------------------------------------+
| EvalDashboard         | Upload datasets, run evals, view score cards.                |
+-----------------------+--------------------------------------------------------------+
| DatasetUploader       | Upload test cases as JSON array.                             |
+-----------------------+--------------------------------------------------------------+
| EvalScoreCard         | Per-eval-run scores: pass_rate, accuracy, format, tools.     |
+-----------------------+--------------------------------------------------------------+
| ShadowDashboard       | View shadow runs, control traffic %, compare outputs.        |
+-----------------------+--------------------------------------------------------------+
| ShadowComparisonTable | Table: live vs shadow output, cost, latency.                 |
+-----------------------+--------------------------------------------------------------+
| ShadowTrafficSlider   | Slider to control candidate traffic percentage.              |
+-----------------------+--------------------------------------------------------------+
| MaturityDashboard     | AI-readiness maturity assessment — matrix, roadmap, scoring, |
|                       | client assessment.                                           |
+-----------------------+--------------------------------------------------------------+
| MaturityMatrix        | 7 dimensions x 5 levels grid with current level + evidence.  |
+-----------------------+--------------------------------------------------------------+
| MaturityRoadmap       | 7 roadmap items with priority/status toggles.                |
+-----------------------+--------------------------------------------------------------+
| MaturityScoringGuide  | 13 yes/no scoring questions per dimension.                   |
+-----------------------+--------------------------------------------------------------+
| AuditTrailTable       | Paginated audit log with actor, action, resource, payload.   |
+-----------------------+--------------------------------------------------------------+
| EmptyState            | Reusable empty state placeholder.                            |
+-----------------------+--------------------------------------------------------------+
| JsonViewer            | Collapsible JSON payload viewer.                             |
+-----------------------+--------------------------------------------------------------+

### Hooks & API

+---------------------------+---------------------------+-----------------------------------------------------+
| Export                    | File                      | Purpose                                             |
+---------------------------+---------------------------+-----------------------------------------------------+
| useStudioDashboard        | hooks/useStudioDashboard  | Orchestrator — wraps prompt, audit, shadow queries  |
|                           |                           | + maturity model. Returns counts, level, progress.  |
+---------------------------+---------------------------+-----------------------------------------------------+
| usePromptLibrary          | hooks/usePromptLibrary    | Prompt CRUD — wraps api/usePrompts hooks.           |
|                           |                           | Manages selected template, version, draft prompt.   |
+---------------------------+---------------------------+-----------------------------------------------------+
| usePlayground             | hooks/usePlayground       | Runs playground prompt against selected models.     |
|                           |                           | Reads/writes store for results + loading state.     |
+---------------------------+---------------------------+-----------------------------------------------------+
| useEvalSuite              | hooks/useEvalSuite        | Wraps api/useEvals — run eval, manage result.       |
+---------------------------+---------------------------+-----------------------------------------------------+
| useShadowTest             | hooks/useShadowTest       | Traffic percentage slider state.                    |
+---------------------------+---------------------------+-----------------------------------------------------+
| useMaturityModel          | hooks/useMaturityModel    | Maturity assessment logic — computes overall level, |
|                           |                           | manages client assessments, roadmap, scoring.       |
+---------------------------+---------------------------+-----------------------------------------------------+
| useAuditTrail             | hooks/useAuditTrail       | Wraps api/useAudit — fetches audit logs.            |
+---------------------------+---------------------------+-----------------------------------------------------+

### TanStack Query Hooks (`api/` — internal, consumed by hooks)

+----------------------+---------------------------+-----------------------------------------------------+
| Export                | File                      | Purpose                                             |
+----------------------+---------------------------+-----------------------------------------------------+
| usePromptTemplates    | api/usePrompts.ts          | Query all prompt templates                          |
| usePromptVersions     | api/usePrompts.ts          | Query versions for a template                       |
| useCreateTemplate     | api/usePrompts.ts          | Mutation — create template                          |
| useCreateVersion      | api/usePrompts.ts          | Mutation — create version                           |
| usePromoteVersion     | api/usePrompts.ts          | Mutation — promote version to production            |
| useRollbackVersion    | api/usePrompts.ts          | Mutation — rollback version                         |
| useCreateDataset      | api/useEvals.ts            | Mutation — create eval dataset                      |
| useRunEval            | api/useEvals.ts            | Mutation — run evaluation                           |
| useEvalRun            | api/useEvals.ts            | Query — get eval run by ID                          |
| useShadowHistory      | api/useShadow.ts           | Query — shadow history for a template               |
| useAuditLogs          | api/useAudit.ts            | Query — audit logs with limit                       |
| useMaturityAssessment | api/useMaturity.ts         | Query — system maturity assessment                  |
| useSaveClientAssessment| api/useMaturity.ts        | Mutation — save client assessment                   |
+----------------------+---------------------------+-----------------------------------------------------+

### Zustand Store (`stores/studioStore.ts`)

+-----------------------+---------------------------+-----------------------------------------------------+
| State                 | Type                      | Description                                         |
+-----------------------+---------------------------+-----------------------------------------------------+
| playgroundResults     | PlaygroundResult[] | null  | Results from last playground run                    |
| isPlaygroundRunning   | boolean                   | Whether playground is executing                      |
| activePromptId        | string | null            | Currently selected prompt in library                |
| playgroundPrompt      | string                    | Current playground prompt text                       |
| playgroundVariables   | Record<string, string>    | Variable substitutions for playground                |
| selectedModels        | string[]                  | Models selected for comparison                       |
+-----------------------+---------------------------+-----------------------------------------------------+

### Types (`types/index.ts`)

+------------------------+---------------------------------------------------------+
| Type                   | Purpose                                                 |
+------------------------+---------------------------------------------------------+
| PromptTemplate         | Prompt template with id, name, active_version           |
| PromptVersion          | Versioned snapshot with status lifecycle                |
| VersionStatus          | 'draft' | 'in_review' | 'shadow' | 'approved'           |
|                        | 'production' | 'rolled_back'                              |
| EvalDataset            | Test case collection with name/description              |
| EvalRun                | Evaluation result with pass_rate + scores               |
| EvalRunDetail          | Per-test-case eval detail                               |
| ShadowRun              | A/B comparison: live vs candidate output/cost/latency   |
| AuditLog               | Operational audit entry                                 |
| PlaygroundResult       | Single model output from playground                     |
| MaturityLevel          | 'L1' | 'L2' | 'L3' | 'L4' | 'L5'                         |
| MaturityDimensionKey   | 'tools' | 'skills' | 'prompts' | 'security'              |
|                        | 'data' | 'observability' | 'documentation'              |
| MaturityLevelInfo      | Level definition with name, color                       |
| MaturityDimension      | Single dimension assessment with current level          |
| SystemMaturityAssessment| Overall system maturity snapshot                        |
| RoadmapItem            | Roadmap entry with priority, status, target level       |
| ScoringQuestion        | Yes/no question per dimension                           |
| ClientAssessmentScore  | Per-dimension client score with evidence                |
| ClientCompanyAssessment| Full client maturity assessment report                  |
+------------------------+---------------------------------------------------------+

### Constants (`constants.ts`)

+-------------------+----------------------------------------------------------------------+
| Constant          | Contents                                                            |
+-------------------+----------------------------------------------------------------------+
| STUDIO_ENDPOINTS  | All API endpoint paths under /studio/*                               |
| STUDIO_QUERY_KEYS | TanStack Query key factory for studio resources                      |
+-------------------+----------------------------------------------------------------------+

### Domain Data (`data/maturity-data.ts`)

+----------------------------+--------------------------------------------------------------+
| Export                     | Contents                                                     |
+----------------------------+--------------------------------------------------------------+
| MATURITY_LEVELS            | 5 levels (L1-L5) with definition, description, color         |
| MATURITY_DIMENSIONS        | 7 dimensions with currentLevel, evidence, L3/L4 patterns     |
| ECHO_SELF_ASSESSMENT_ROADMAP | 7 roadmap items with priority/status/targetLevel           |
| SCORING_QUESTIONS          | 13 yes/no assessment questions per dimension                 |
+----------------------------+--------------------------------------------------------------+

## Dependencies

### Internal

- `@/lib/api-client` — `api.get()`, `api.post()` for all CRUD
- `@/utils/cn` — classname merging
- `@/components/ui/Skeleton` — loading skeletons
- `@/components/ui/Badge` — status badges
- `@/components/ui/Button` — action buttons
- `lucide-react` — icons

### External

- `zustand` — playground state management
- `@tanstack/react-query` — server state (prompts, evals, shadow, audit, maturity)

## API Routes

All under `/api/v1/studio/*`. See `docs/shared/contracts/endpoints.md` for full route table.

## Source References

+-----------------------------------------------------------+---------+--------------------------------------------------+
| File                                                      | Lines   | Description                                      |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/types/index.ts                        | 1-175   | All studio types: Prompt*, Eval*, ShadowRun,     |
|                                                           |         | AuditLog, PlaygroundResult, Maturity*            |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/constants.ts                          | 1-25    | STUDIO_ENDPOINTS, STUDIO_QUERY_KEYS              |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/data/maturity-data.ts                 | 1-315   | MATURITY_LEVELS, MATURITY_DIMENSIONS,            |
|                                                           |         | ECHO_SELF_ASSESSMENT_ROADMAP, SCORING_QUESTIONS  |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/stores/studioStore.ts                 | 1-34    | Zustand store — playground state + 7 setters     |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/api/usePrompts.ts                     | 1-100   | TanStack Query hooks for prompt CRUD             |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/api/useEvals.ts                       | 1-50    | TanStack Query hooks for eval datasets + runs    |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/api/useShadow.ts                      | 1-20    | TanStack Query hook for shadow history            |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/api/useAudit.ts                       | 1-20    | TanStack Query hook for audit logs               |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/api/useMaturity.ts                    | 1-25    | TanStack Query hooks for maturity assessment     |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/hooks/useStudioDashboard.ts           | 1-35    | Orchestrator — counts, maturity, refresh         |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/hooks/usePromptLibrary.ts             | 1-70    | Prompt CRUD orchestration + state                |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/hooks/usePlayground.ts                | 1-61    | Playground execution + store integration         |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/hooks/useEvalSuite.ts                 | 1-30    | Eval run orchestration                           |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/hooks/useShadowTest.ts                | 1-8     | Traffic slider state                             |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/hooks/useMaturityModel.ts             | 1-187   | Maturity assessment logic                        |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/hooks/useAuditTrail.ts                | 1-10    | Audit log wrapper                                |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/index.ts                              | 1-52    | Barrel exports — components, hooks, types        |
+-----------------------------------------------------------+---------+--------------------------------------------------+

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
