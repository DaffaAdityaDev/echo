================================================================================
  KataraGnosis Domain Layer - Models & Constants
================================================================================
  Module    : Domain Layer
  Service   : katara-gnosis
  Version   : 1.0
  Updated   : 2026-08-18
================================================================================

The Domain layer defines the business data structures shared by the Go
backend (handlers, services, repositories) and mirrored as TypeScript types
in the frontend.

Documentation Index
-------------------

+------------------------------------------+-----------------------------------+
| Module                                   | Description                       |
+------------------------------------------+-----------------------------------+
| models.md                                | ERD, table-by-table columns,      |
|                                          | JSONB shapes, Qdrant payloads     |
| constants.md                             | Enums, CHECK constraints,         |
|                                          | defaults, route constants         |
+------------------------------------------+-----------------------------------+

Naming Conventions
------------------

+---------------------+----------------------------------------------------+
| Concern             | Rule                                               |
+---------------------+----------------------------------------------------+
| Table names         | snake_case, singular (`lakes`, `sources`,          |
|                     | `flashcards`) — follows echo `users`/`sessions`.   |
| Column names        | snake_case (`sub_topic`, `due_at`).                |
| Go structs          | internal/models/katara/*.go, PascalCase, JSON      |
|                     | tags snake_case.                                   |
| TS types            | features/*/types/index.ts, PascalCase interfaces,  |
|                     | camelCase fields (mapped from snake_case).         |
| Multi-tenant        | Every user-owned row carries `user_id`; Qdrant     |
|                     | payloads carry `user_id` and all searches filter   |
|                     | on it.                                             |
+---------------------+----------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
