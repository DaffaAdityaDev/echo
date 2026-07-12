================================================================================
  Infrastructure Layer - Server, Routing, Database & Observability
================================================================================
  Module    : Infrastructure Layer
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

The Infrastructure layer provides technical capabilities that support the
application: HTTP server lifecycle, routing, database connections, and
observability plumbing.

Documentation Index
-------------------

+------------------------------------------+----------------------------------------------------+
| Module                                   | Description                                        |
+------------------------------------------+----------------------------------------------------+
| database.md                              | PostgreSQL (pgx pool) and Redis connection          |
|                                          | management, connection lifecycle, pool config      |
| routing.md                               | Route definitions, API versioning (v1), DI wiring, |
|                                          | path constants, middleware binding                  |
| server-lifecycle.md                      | Startup sequence, graceful shutdown planning,      |
|                                          | Fiber configuration, middleware registration       |
| observability.md                         | OpenTelemetry distributed tracing, span creation,  |
|                                          | traceparent propagation, OTLP gRPC exporter        |
+------------------------------------------+----------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
