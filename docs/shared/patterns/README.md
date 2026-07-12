================================================================================
  PATTERNS — DOCUMENTATION INDEX
================================================================================
  Module    : Patterns
  Service   : Shared / Patterns
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Overview

Implementation patterns covering Echo's key runtime behaviors: real-time
streaming, observability tracing, container deployment, authentication, and
error handling.

## Document Index

+----------------------------+---------------------------------------------------+-------------------------+
| File                       | Description                                       | Status                  |
+----------------------------+---------------------------------------------------+-------------------------+
| sse-streaming.md           | End-to-end SSE flow — agent to frontend, dual     | Completed               |
|                            |   mode (local/SaaS)                               |                         |
| observability.md           | OpenTelemetry traces, Langfuse LLM observability, | Completed               |
|                            |   Prometheus metrics, Grafana dashboards          |                         |
| container-first-           | Docker Compose + Kubernetes deployment —          | Completed               |
| deployment.md              |   multi-stage builds, startup order               |                         |
| auth-flow.md               | JWT auth chain — Go gateway, agent internal       | Completed               |
|                            |   auth, frontend React Query hooks                |                         |
| error-handling.md          | Cross-service error taxonomy, consistent JSON     | Completed               |
|                            |   error format, in-stream error events            |                         |
+----------------------------+---------------------------------------------------+-------------------------+

## Quick Reference

+--------------------------------------+---------------------------------------------+
| Topic                                | Document                                    |
+--------------------------------------+---------------------------------------------+
| SSE stream architecture              | sse-streaming.md                            |
| Dual-mode streaming                  | sse-streaming.md                            |
| W3C trace propagation                | observability.md                            |
| Langfuse integration                 | observability.md                            |
| Docker Compose setup                 | container-first-deployment.md               |
| K8s deploy commands                  | container-first-deployment.md               |
| JWT token flow                       | auth-flow.md                                |
| Internal service auth                | auth-flow.md                                |
| Unified error shape                  | error-handling.md                           |
| Error status codes                   | error-handling.md                           |
+--------------------------------------+---------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
