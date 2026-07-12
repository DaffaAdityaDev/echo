================================================================================
  SHARED — DOCUMENTATION INDEX
================================================================================
  Module    : Shared
  Service   : Shared
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Overview

Shared documentation for Echo's cross-cutting concerns: architectural patterns,
inter-service contracts, implementation patterns, and domain models.

## Subdirectory Index

+----------------+----------------------------------------------+
| Directory      | Description                                  |
+----------------+----------------------------------------------+
| architecture/  | System architecture decisions — HaaS, zero   |
|                |   tight coupling                             |
| contracts/     | API contracts — JSON schemas, endpoints,     |
|                |   database schema, env vars                  |
| patterns/      | Implementation patterns — SSE streaming,     |
|                |   observability, deployment, auth, errors    |
| domain/        | Domain model documentation — data flow,      |
|                |   roles/permissions, glossary                |
+----------------+----------------------------------------------+

## Quick Reference

+--------------------------------------+---------------------------------------------+
| Topic                                | Document                                    |
+--------------------------------------+---------------------------------------------+
| Headless HaaS architecture           | architecture/headless-haas.md               |
| Zero tight coupling                  | architecture/zero-tight-coupling.md         |
| JSON API contract                    | contracts/json-api-contract.md              |
| Database schema                      | contracts/database-schema.md                |
| API endpoints                        | contracts/endpoints.md                      |
| Environment contract                 | contracts/env-contract.md                   |
| SSE streaming pattern                | patterns/sse-streaming.md                   |
| Observability pattern                | patterns/observability.md                   |
| Container-first deployment           | patterns/container-first-deployment.md      |
| Auth flow                            | patterns/auth-flow.md                       |
| Error handling                       | patterns/error-handling.md                  |
| Models data flow                     | domain/models-data-flow.md                  |
| Roles & permissions                  | domain/roles-and-permissions.md             |
| Domain glossary                      | domain/glossaries.md                        |
+--------------------------------------+---------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
