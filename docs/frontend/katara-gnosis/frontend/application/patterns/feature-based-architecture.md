================================================================================
  KataraGnosis Frontend Feature-Based Architecture
================================================================================
  Module    : Feature-Based Architecture
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
  Status    : Design (pre-implementation)
================================================================================

Overview
--------

Feature-module pattern copied verbatim from
docs/frontend/web/application/patterns/feature-based-architecture.md:
features own their components, hooks, services, stores, types, and
constants; shared plumbing lives in lib/; generic UI in components/ui/.

Feature Layout
--------------

  src/features/<feature>/
  ├── components/        # <Feature>Page + sub-components
  ├── hooks/             # page-hooks + domain hooks
  ├── services/          # <feature>-api.ts (axios via api client)
  ├── stores/            # zustand stores (UI state only)
  ├── types/index.ts     # interfaces + mappings
  ├── constants.ts       # query keys, endpoint constants
  └── index.ts           # barrel: components + hooks + types

Feature Inventory
-----------------

+--------------+------------------------------------------------------------+
| Feature      | Responsibility                                              |
+--------------+------------------------------------------------------------+
| auth         | LoginPage, AuthGuard, useAuth (["auth","me"]), login/       |
|              | logout mutations, authStore                                 |
| library      | Lakes CRUD UI, Source upload + polling, Source detail       |
|              | (chunks reader + TipTap editor), semantic search, manual    |
|              | flashcard creation                                          |
| drill        | DrillPage runner, question cards, timer + latency, answer   |
|              | feedback panel, results screen, drillStore                  |
| progress     | DashboardPage (daily feed), ProgressPage (mastery matrix,   |
|              | hesitation, weekly sheet), streak display                   |
| settings     | Session size, targets, thresholds, grace, lake weights,     |
|              | provider/model info (read-only from /api/katara/settings)   |
| shared       | Markdown renderer, KaTeX wrapper, MasteryBar, StreakBadge,  |
|              | EmptyState, PageHeader, Sidebar shell                       |
+--------------+------------------------------------------------------------+

Layer Rules (logic-layering.md, enforced)
-----------------------------------------

  component -> hook -> service -> api-client -> BFF route -> backend

  - Components never import zustand/RQ directly (traces/page.tsx in
    frontend/web is a known deviation — KataraGnosis will not repeat it).
  - Hooks are the only bridge to stores/queries.
  - Cross-feature imports discouraged; exceptions allowed only for
    shared/ and (progress <-> library) for mastery dots in the sidebar.

Naming Conventions
------------------

  +----------------------+----------------------------------------------+
  | Concern              | Convention                                   |
  +----------------------+----------------------------------------------+
  | Files                | kebab-case (lake-api.ts, useLakeList.ts)     |
  | Types/Interfaces     | PascalCase (interface Lake, Flashcard)       |
  | Components           | PascalCase (LakeCard, QuestionCard)          |
  | Hooks                | use* (useLakes, useUploadSource)             |
  | Services             | camelCase objects (lakeApi, drillApi)        |
  | Constants            | UPPER_SNAKE (KATARA_ENDPOINTS) + as const    |
  | Barrel exports       | index.ts re-exports only public API          |
  +----------------------+----------------------------------------------+

Type Mapping
------------

Backend snake_case -> frontend camelCase, explicitly mapped (no blind
spread). Example (features/library/types/index.ts):

  export interface Flashcard {
    id: string;
    sourceId: string;
    lakeId: string;
    content: string;
    domain: string;
    subTopic: string;
    archetype: "conceptual" | "procedural" | "scenario";
    keypoints: string[];
    position: number;
    createdAt: string;
  }

  export function mapFlashcard(raw: any): Flashcard { ... }

Strict typing: no `any` leaking through service boundaries (zod optional
for BFF responses where payloads are dynamic — prefer explicit mappers).

Verification
------------

  npx tsc --noEmit && bun run lint && bun run build  (biome gates)

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
