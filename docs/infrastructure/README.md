================================================================================
  INFRASTRUCTURE — DOCUMENTATION INDEX
================================================================================
  Module    : Infrastructure
  Service   : Infrastructure
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Overview

Documentation for Echo infrastructure services: Docker Compose orchestration,
Kubernetes pod topology, monitoring/observability pipeline, and database store
initialization.

## Document Index

+--------------------+-------------------------------------------+-------------------------+
| File               | Description                               | Status                  |
+--------------------+-------------------------------------------+-------------------------+
| docker-compose.md  | Docker Compose service topology and       | Completed               |
|                    |   orchestration definitions               |                         |
| kubernetes.md      | Kubernetes pod topology and manifest      | Completed               |
|                    |   reference                               |                         |
| monitoring.md      | Observability pipeline — OTel,            | Completed               |
|                    |   Prometheus, Grafana, Jaeger             |                         |
| database.md        | Data store configuration — Postgres,      | Completed               |
|                    |   Redis, ChromaDB, RabbitMQ               |                         |
+--------------------+-------------------------------------------+-------------------------+

## Quick Reference

+---------------------+-----------------------------------------------------+
| Topic               | Document                                            |
+---------------------+-----------------------------------------------------+
| Service topology    | docker-compose.md                                   |
| Container config    | docker-compose.md                                   |
| K8s manifests       | kubernetes.md                                       |
| Pod communication   | kubernetes.md                                       |
| OTel pipeline       | monitoring.md                                       |
| Metrics & dashboards| monitoring.md                                       |
| Database init       | database.md                                         |
| Backup strategies   | database.md                                         |
+---------------------+-----------------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
