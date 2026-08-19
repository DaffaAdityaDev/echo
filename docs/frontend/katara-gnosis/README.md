================================================================================
  KataraGnosis Documentation Index
================================================================================
  Module    : Documentation Index
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
================================================================================

KataraGnosis is a standalone, AI-driven learning and test-preparation platform
built on top of the Echo monorepo. It targets BUMN and Bank Indonesia selection
tests (TKD, AKHLAK, macroeconomics, interview/FGD) but is domain-agnostic —
any knowledge lake (piano theory, software engineering, exam prep) can be
loaded, atomized, drilled, and tracked.

This documentation tree is the single source of truth for the KataraGnosis
design. It is written docs-first: every document is a pre-implementation
design spec that drives the build phases. Markers such as
"Implementation Status: Design" appear on documents whose code does not exist
yet.

Documentation Index
-------------------

+----------------------------------+----------------------------------------------+
| Module                           | Description                                  |
+----------------------------------+----------------------------------------------+
| architecture.md                  | Overall blueprint: stack, components, data   |
|                                  | flows, decision summary                      |
| daily-protocol.md                | Daily practice pattern: 70/30 mix, scoring,  |
|                                  | streaks, anti-fatigue rules, progression     |
| domain/                          | Business models (ERD, JSONB shapes) and      |
|                                  | constants/enums                              |
| backend/                         | Go backend domain: routing, database,        |
|                                  | Asynq worker, ingestion pipeline, drill      |
|                                  | engine, progress, embeddings                 |
| frontend/                        | Next.js app: routing, state, BFF API client, |
|                                  | feature modules, TipTap editor, design system|
| infrastructure/                  | docker-compose, GarageHQ, Qdrant, env        |
|                                  | contract                                     |
| shared/                          | ADRs and endpoint JSON contracts             |
+----------------------------------+----------------------------------------------+

Documentation Tree
------------------

  docs/frontend/katara-gnosis/
  ├── README.md                     <- this file
  ├── architecture.md
  ├── daily-protocol.md
  ├── domain/
  │   ├── README.md
  │   ├── models.md
  │   └── constants.md
  ├── backend/
  │   ├── README.md
  │   ├── infrastructure/
  │   │   ├── routing.md
  │   │   ├── database.md
  │   │   └── worker.md
  │   └── application/
  │       ├── patterns/
  │       │   └── ingestion-pipeline.md
  │       ├── features/
  │       │   ├── libraries.md
  │       │   ├── drills.md
  │       │   ├── progress.md
  │       │   └── embeddings.md
  │       └── shared/
  │           ├── ai-call-pattern.md
  │           └── error-handling.md
  ├── frontend/
  │   ├── README.md
  │   ├── infrastructure/
  │   │   ├── routing.md
  │   │   ├── state-management.md
  │   │   └── api-client.md
  │   ├── application/
  │   │   ├── patterns/
  │   │   │   ├── feature-based-architecture.md
  │   │   │   └── editor-integration.md
  │   │   └── features/
  │   │       ├── auth.md
  │   │       ├── library.md
  │   │       ├── drill.md
  │   │       └── dashboard-progress.md
  │   └── design-system/
  │       ├── tokens.md
  │       ├── components.md
  │       └── tailwind.md
  └── infrastructure/
      ├── README.md
      ├── docker-compose.md
      ├── garage.md
      ├── qdrant.md
      └── env-contract.md
  └── shared/
      ├── README.md
      ├── adr.md
      └── contracts.md

Conventions
-----------

+------------------+--------------------------------------------------------+
| Concern          | Rule                                                   |
+------------------+--------------------------------------------------------+
| Language         | Documentation and code are English. UI copy (labels,   |
|                  | buttons, toasts) is Bahasa Indonesia.                  |
| Format           | Banner header, bordered tables, ASCII diagrams, footer |
|                  | as in docs/backend and docs/frontend/web.              |
| Naming           | Go: snake_case files, camelCase/PascalCase symbols.    |
|                  | TS: kebab-case files, camelCase/PascalCase symbols.    |
+------------------+--------------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
