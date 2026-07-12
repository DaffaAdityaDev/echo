================================================================================
  Patterns - Architectural Design Patterns
================================================================================
  Module    : Architectural Patterns
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

This directory documents the architectural patterns used in the Echo backend
service to ensure maintainability, testability, and separation of concerns.

Documentation Index
-------------------

+------------------------------------------+----------------------------------------------------+
| Module                                   | Description                                        |
+------------------------------------------+----------------------------------------------------+
| repository-pattern.md                    | Data access abstraction via interfaces, pgx pool,  |
|                                          | transaction handling, SQL query constants          |
| service-layer.md                         | Business logic decoupling, DI wiring, pure Go      |
|                                          | interfaces without framework dependencies          |
| handler-pattern.md                       | Thin HTTP layer, request parsing, response         |
|                                          | formatting, streaming SSE pattern, error mapping   |
| middleware-chain.md                      | Request pipeline: recover, logger, CORS, JWT,      |
|                                          | custom middleware implementations                  |
+------------------------------------------+----------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
