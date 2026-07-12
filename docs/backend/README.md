================================================================================
  Echo Backend - Documentation Index
================================================================================
  Module    : Documentation Root
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

This directory contains the enterprise documentation for the Echo backend
service. The architecture follows Domain-Driven Design with clear layering:
infrastructure, application (features + patterns), domain, and shared.

Directory Structure
-------------------

+----------------------+------------------------------------------------------------+
| Directory            | Description                                                |
+----------------------+------------------------------------------------------------+
| application/         | Application layer: features and architectural patterns     |
| domain/              | Domain layer: models, constants, and business entities     |
| infrastructure/      | Infrastructure layer: server, routing, database, tracing   |
| shared/              | Shared utilities: config loading, error handling, tracing  |
+----------------------+------------------------------------------------------------+

Applications & Patterns
-----------------------

+------------------------------------------+----------------------------------------------------+
| Module                                   | Description                                        |
+------------------------------------------+----------------------------------------------------+
| application/features/auth.md             | JWT authentication, registration & login flow      |
| application/features/chat-streaming.md   | SSE relay, agent communication, mission streaming  |
| application/features/model-management.md | Provider-agnostic model resolution & caching       |
| application/patterns/repository-pattern.md| Data access layer with pgx and interface pattern  |
| application/patterns/service-layer.md    | Business logic decoupling from HTTP handlers       |
| application/patterns/handler-pattern.md  | Thin HTTP layer for request/response handling      |
| application/patterns/middleware-chain.md | Request pipeline: recovery, logging, CORS, JWT     |
+------------------------------------------+----------------------------------------------------+

Infrastructure
--------------

+------------------------------------------+----------------------------------------------------+
| Module                                   | Description                                        |
+------------------------------------------+----------------------------------------------------+
| infrastructure/database.md               | PostgreSQL (pgx) and Redis connection management   |
| infrastructure/routing.md                | Route definitions, API versioning, DI wiring       |
| infrastructure/server-lifecycle.md       | Startup sequence, graceful shutdown planning       |
| infrastructure/observability.md          | OpenTelemetry distributed tracing configuration    |
+------------------------------------------+----------------------------------------------------+

Domain
------

+------------------------------------------+----------------------------------------------------+
| Module                                   | Description                                        |
+------------------------------------------+----------------------------------------------------+
| domain/models.md                         | Domain struct definitions, relationships, JSON tags|
| domain/constants.md                      | Application constants by domain package            |
+------------------------------------------+----------------------------------------------------+

Shared
------

+------------------------------------------+----------------------------------------------------+
| Module                                   | Description                                        |
+------------------------------------------+----------------------------------------------------+
| shared/config-loading.md                 | Environment-based configuration with defaults       |
| shared/observability-setup.md            | OTel tracer initialization and span patterns       |
| shared/error-handling.md                 | Error types, HTTP status mapping, error constants  |
+------------------------------------------+----------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
