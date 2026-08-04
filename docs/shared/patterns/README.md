================================================================================
  PATTERNS — DOCUMENTATION INDEX
================================================================================
  Module    : Patterns
  Service   : Shared / Patterns
  Version   : 1.4
  Updated   : 2026-08-04 (added Anti-Slop standard)
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
| acid-solid-clean-code.md   | ACID transactions, session isolation, SOLID       | Completed               |
|                            |   patterns, Clean Code conventions                |                         |
| ai-ready-maturity.md       | Abstract 5-level maturity model for AI readiness  | Completed               |
|                            |   — internal + external, decoupled from patterns  |                         |
| strategy-lifecycle.md      | Strategy versioning, session pinning, canary      | Active (2026-07-31)    |
|                            |   rollout, 3-phase sunset pipeline                |                         |
| anti-slop.md               | Anti-slop standard for AI-assisted code           | Completed               |
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
| ACID transaction patterns            | acid-solid-clean-code.md                    |
| Session-level mutex isolation        | acid-solid-clean-code.md                    |
| SOLID principles                     | acid-solid-clean-code.md                    |
| Clean Code conventions               | acid-solid-clean-code.md                    |
| AI slop anti-patterns                | anti-slop.md                               |
| Atomic changes / commit discipline   | acid-solid-clean-code.md                    |
| Performance rules                    | acid-solid-clean-code.md                    |
| AI readiness self-assessment         | ai-ready-maturity.md                        |
| Client maturity assessment           | ai-ready-maturity.md                        |
| Agentic system maturity levels       | ai-ready-maturity.md                        |
| Strategy versioning & rollout        | strategy-lifecycle.md                       |
| Canary rollout rules                 | strategy-lifecycle.md                       |
| Strategy sunset pipeline             | strategy-lifecycle.md                       |
+--------------------------------------+---------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
