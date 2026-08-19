===============================================================================
  Studio Feature (LLMOps)
===============================================================================
  Module    : Studio Feature
  Service   : Web
  Version   : 1.0
  Updated   : 2026-07-25
===============================================================================

## Deskripsi

The AI Studio feature — an LLMOps workbench for managing prompts and AI-readiness maturity assessment. Provides tools for prompt engineers, domain experts, and product managers to govern AI behavior through structured contracts.

## File Structure

```
src/features/studio/
├── constants.ts
├── index.ts
├── data/
│   └── maturity-data.ts
├── api/
│   ├── useMaturity.ts
│   └── usePrompts.ts
├── hooks/
│   ├── useMaturityModel.ts
│   ├── useMaturityPage.ts
│   └── usePromptLibrary.ts
├── components/
│   ├── shared/
│   │   └── EmptyState.tsx
│   ├── prompts/
│   │   ├── PromptsPage.tsx
│   │   ├── PromptLibrary.tsx
│   │   ├── PromptVersionTimeline.tsx
│   │   ├── VersionDiffViewer.tsx
│   │   └── VersionStatusBadge.tsx
│   └── maturity/
│       ├── MaturityDashboard.tsx
│       ├── MaturityMatrix.tsx
│       ├── MaturityRoadmap.tsx
│       └── MaturityScoringGuide.tsx
└── types/
    └── index.ts
```

## Flow Diagrams

### Component Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│  PromptsPage                                                             │
│  ┌────────────────────────┐                                             │
│  │  PromptLibrary         │                                             │
│  │  (list + CRUD)         │                                             │
│  │  ┌──────────────────┐  │                                             │
│  │  │ VersionTimeline  │  │                                             │
│  │  │ + DiffViewer     │  │                                             │
│  │  │ + StatusBadge    │  │                                             │
│  │  └──────────────────┘  │                                             │
│  └────────────────────────┘                                             │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│  MaturityDashboard                                                       │
│  ┌────────────────────────┐                                               │
│  │  MaturityMatrix        │                                               │
│  │  (7 dimensions x L1-5) │                                               │
│  ├────────────────────────┤                                               │
│  │  MaturityRoadmap       │                                               │
│  │  (7 roadmap items)     │                                               │
│  ├────────────────────────┤                                               │
│  │  MaturityScoringGuide  │                                               │
│  │  (13 scoring questions)│                                               │
│  └────────────────────────┘                                               │
└───────────────────────────────────────────────────────────────────────────┘
```

## Entry Points & Exports

### Barrel (`src/features/studio/index.ts`)

+----------------------------+-------------+------------------------------------------------------+
| Export                     | Kind        | Source                                               |
+----------------------------+-------------+------------------------------------------------------+
| EmptyState                 | Component   | components/shared/EmptyState.tsx                      |
| MaturityDashboard          | Component   | components/maturity/MaturityDashboard.tsx             |
| MaturityMatrix             | Component   | components/maturity/MaturityMatrix.tsx                |
| MaturityRoadmap            | Component   | components/maturity/MaturityRoadmap.tsx               |
| MaturityScoringGuide       | Component   | components/maturity/MaturityScoringGuide.tsx          |
| PromptsPage                | Component   | components/prompts/PromptsPage.tsx                    |
| PromptLibrary              | Component   | components/prompts/PromptLibrary.tsx                  |
| PromptVersionTimeline      | Component   | components/prompts/PromptVersionTimeline.tsx          |
| VersionDiffViewer          | Component   | components/prompts/VersionDiffViewer.tsx              |
| VersionStatusBadge         | Component   | components/prompts/VersionStatusBadge.tsx             |
| useMaturityModel           | Hook        | hooks/useMaturityModel.ts                             |
| useMaturityPage            | Hook        | hooks/useMaturityPage.ts                              |
| usePromptLibrary           | Hook        | hooks/usePromptLibrary.ts                             |
| all types                  | Type        | types/index.ts                                        |
+----------------------------+-------------+------------------------------------------------------+

> **Note:** `api/`, `constants.ts`, and `data/` are internal — not re-exported from the barrel.

### Components

+-----------------------+--------------------------------------------------------------+
| Component             | Description                                                  |
+-----------------------+--------------------------------------------------------------+
| PromptsPage           | Full prompt management page with library + version timeline. |
+-----------------------+--------------------------------------------------------------+
| PromptLibrary         | List of prompt templates with create/new-version actions.    |
+-----------------------+--------------------------------------------------------------+
| PromptVersionTimeline | Vertical timeline of versions for a selected template.       |
+-----------------------+--------------------------------------------------------------+
| VersionDiffViewer     | Side-by-side diff between two prompt versions.               |
+-----------------------+--------------------------------------------------------------+
| VersionStatusBadge    | Colored badge: draft, in_review, approved,                   |
|                       | production, rolled_back.                                     |
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
| EmptyState            | Reusable empty state placeholder.                            |
+-----------------------+--------------------------------------------------------------+

### Hooks & API

+---------------------------+---------------------------+-----------------------------------------------------+
| Export                    | File                      | Purpose                                             |
+---------------------------+---------------------------+-----------------------------------------------------+
| usePromptLibrary          | hooks/usePromptLibrary    | Prompt CRUD — wraps api/usePrompts hooks.           |
|                           |                           | Manages selected template, version, draft prompt.   |
+---------------------------+---------------------------+-----------------------------------------------------+
| useMaturityPage           | hooks/useMaturityPage     | Maturity page orchestration — counts, matrix,       |
|                           |                           | roadmap, scoring, client assessment.                |
+---------------------------+---------------------------+-----------------------------------------------------+
| useMaturityModel          | hooks/useMaturityModel    | Maturity assessment logic — computes overall level, |
|                           |                           | manages client assessments, roadmap, scoring.       |
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
| useMaturityAssessment | api/useMaturity.ts         | Query — system maturity assessment                  |
| useSaveClientAssessment| api/useMaturity.ts        | Mutation — save client assessment                   |
+----------------------+---------------------------+-----------------------------------------------------+

### Types (`types/index.ts`)

+------------------------+---------------------------------------------------------+
| Type                   | Purpose                                                 |
+------------------------+---------------------------------------------------------+
| PromptTemplate         | Prompt template with id, name, active_version           |
| PromptVersion          | Versioned snapshot with status lifecycle                |
| VersionStatus          | 'draft' | 'in_review' | 'approved'                |
|                        | 'production' | 'rolled_back'                              |
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

- `zustand` — studio state management
- `@tanstack/react-query` — server state (prompts, maturity)

## Page Routes

| Route      | Page                              | Component                                 |
|------------|-----------------------------------|-------------------------------------------|
| `/prompts` | `app/(main)/prompts/page.tsx`     | `PromptsPage` — prompt library, versions, diff, promote/rollback |
| `/maturity`| `app/(main)/maturity/page.tsx`    | `MaturityDashboard` — AI-readiness assessment |

## API Routes

All under `/api/v1/studio/*`. See `docs/shared/contracts/endpoints.md` for full route table.

## Source References

+-----------------------------------------------------------+---------+--------------------------------------------------+
| File                                                      | Lines   | Description                                      |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/types/index.ts                        | 1-175   | All studio types: Prompt*, Maturity*                |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/constants.ts                          | 1-25    | STUDIO_ENDPOINTS, STUDIO_QUERY_KEYS              |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/data/maturity-data.ts                 | 1-315   | MATURITY_LEVELS, MATURITY_DIMENSIONS,            |
|                                                           |         | ECHO_SELF_ASSESSMENT_ROADMAP, SCORING_QUESTIONS  |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/api/usePrompts.ts                     | 1-100   | TanStack Query hooks for prompt CRUD             |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/api/useMaturity.ts                    | 1-25    | TanStack Query hooks for maturity assessment     |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/hooks/usePromptLibrary.ts             | 1-70    | Prompt CRUD orchestration + state                |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/hooks/useMaturityPage.ts              | 1-80    | Maturity page orchestration                      |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/hooks/useMaturityModel.ts             | 1-187   | Maturity assessment logic                        |
+-----------------------------------------------------------+---------+--------------------------------------------------+
| src/features/studio/index.ts                              | 1-31    | Barrel exports — components, hooks, types        |
+-----------------------------------------------------------+---------+--------------------------------------------------+

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
