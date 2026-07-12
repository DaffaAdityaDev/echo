================================================================================
  Shared Utilities - Cross-Cutting Concerns
================================================================================
  Module    : Shared Utilities
  Service   : backend
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

Shared utilities provide cross-cutting functionality used across application,
infrastructure, and domain layers.

Documentation Index
-------------------

+------------------------------------------+----------------------------------------------------+
| Module                                   | Description                                        |
+------------------------------------------+----------------------------------------------------+
| config-loading.md                        | Environment-based configuration with env vars,     |
|                                          | defaults, helper functions (getEnv, splitEnv)      |
| observability-setup.md                   | OpenTelemetry tracer initialization, exporter      |
|                                          | config, span creation patterns, traceparent        |
| error-handling.md                        | Error response format, HTTP status code mapping,   |
|                                          | global error handler, error constants              |
+------------------------------------------+----------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
