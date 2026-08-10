================================================================================
  CONTRACTS — DOCUMENTATION INDEX
================================================================================
  Module    : Contracts
  Service   : Shared / Contracts
   Version   : 1.2
   Updated   : 2026-08-07 (mission→session collapse: single sessionId on the wire)
================================================================================

## Overview

Inter-service API contracts defining request/response shapes, database schema,
endpoint routing, and environment variable governance.

## Document Index

+--------------------+---------------------------------------------------+-------------------------+
| File               | Description                                       | Status                  |
+--------------------+---------------------------------------------------+-------------------------+
| json-api-          | Cross-service JSON request/response schemas,      | Completed               |
| contract.md        |   error format, SSE events, status codes          |                         |
| database-          | PostgreSQL schema with pgvector — all tables,     | Completed               |
| schema.md          |   indexes, migration strategy                     |                         |
| endpoints.md       | Complete route table across Go, Agent, Frontend   | Completed               |
| env-contract.md    | Environment variables per service, prefixes,      | Completed               |
|                    |   precedence rules, defaults                      |                         |
|                    | (WORKER_*, DECAY_*, STRATEGY_ROLLOUT_DEFAULT      | Active (2026-07-31)     |
|                    |   added to sections above)                        |                         |
+--------------------+---------------------------------------------------+-------------------------+

## Quick Reference

+--------------------------------------+---------------------------------------------+
| Topic                                | Document                                    |
+--------------------------------------+---------------------------------------------+
| Error response format                | json-api-contract.md                        |
| SSE event types                      | json-api-contract.md                        |
| Table definitions                    | database-schema.md                          |
| Index definitions                    | database-schema.md                          |
| Public API routes                    | endpoints.md                                |
| Internal agent routes                | endpoints.md                                |
| Rate limits                          | endpoints.md                                |
| Shared env prefixes                  | env-contract.md                             |
| Precedence rules                     | env-contract.md                             |
| Strategy version pin (schema)        | database-schema.md                          |
| Strategy catalog endpoints           | endpoints.md                                |
| Chat payload strategy fields         | json-api-contract.md                        |
+--------------------------------------+---------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
