================================================================================
  CONTRACTS — DOCUMENTATION INDEX
================================================================================
  Module    : Contracts
  Service   : Shared / Contracts
  Version   : 1.0
  Updated   : 2026-07-09
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
+--------------------------------------+---------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
