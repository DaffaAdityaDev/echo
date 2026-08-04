================================================================================
  DOCKER COMPOSE — SERVICE TOPOLOGY & ORCHESTRATION
================================================================================
  Module    : Docker Compose
  Service   : Infrastructure
  Version   : 1.1
  Updated   : 2026-07-31 (planned: in-process lifecycle worker note)
================================================================================

## Description

The Docker Compose stack defines the Echo application runtime: two data stores
(Postgres, Redis), a full observability pipeline (OTel Collector → Prometheus/
Grafana/Jaeger — currently commented out and disabled by default), and three
application services (agent, backend, frontend). Base composition
(`docker-compose.yml`) provides infrastructure-only. Dev and Prod overrides
layer on the application services with different build, volume, and environment
strategies.

## File Structure

+----------------------------+--------------------------------------------------------+
| File                       | Purpose                                                |
+----------------------------+--------------------------------------------------------+
| docker-compose.yml         | Base infrastructure (data + observability)             |
| docker-compose.dev.yml     | Dev overrides — hot-reload, source mounts              |
| docker-compose.prod.yml    | Prod overrides — pre-built images, no bind mounts      |
| Makefile                   | Orchestration targets (dev-up, prod-down, etc.)        |
+----------------------------+--------------------------------------------------------+

## ASCII Flow Diagram — Full Service Topology

┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              DOCKER NETWORK                                           │
│                                                                                       │
│  ┌────────────────┐    HTTP/3002    ┌────────────────┐    HTTP/8080                   │
│  │   Frontend     │ ◄──────────────►│    Backend     │ ◄────────────────────────────┐ │
│  │    :3002       │  NEXT_PUBLIC    │    :8080       │                              │ │
│  └────────────────┘    API_URL      └───────┬────────┘                              │ │
│                                             │                                        │ │
│                        ┌────────────────────┼────────────────────┐                   │ │
│                        ▼                    ▼                    ▼                   │ │
│                  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │ │
│                  │   Postgres   │    │    Redis     │    │    Agent     │           │ │
│                  │    :5432     │    │    :6379     │    │    :3001     │           │ │
│                  │   pgvector   │    │   sessions   │    │   LLM call   │───────────┘ │
│                  └──────────────┘    └──────────────┘    └──────────────┘             │
│                                                                                       │
│                  ┌──────────────┐    ┌──────────────┐                                 │
│                  │  (not in     │    │  (not in     │                                 │
│                  │   compose)   │    │   compose)   │                                 │
│                  └──────────────┘    └──────────────┘                                 │
│                                                                                       │
│  ┌──────────────┐    ┌──────────────────────┐    ┌──────────────┐                    │
│  │   Jaeger     │◄───│  OTel Collector      │───►│  Prometheus  │                    │
│  │   :16686     │    │  :4317 / :4318       │    │   :9090      │                    │
│  └──────────────┘    └──────────────────────┘    └──────┬───────┘                    │
│                                                          │                            │
│                                                          ▼                            │
│                                                   ┌──────────────┐                   │
│                                                   │   Grafana    │                   │
│                                                   │   :3000      │                   │
│                                                   └──────────────┘                   │
└──────────────────────────────────────────────────────────────────────────────────────┘

> **Note:** Grafana listens internally on port 3000. In development it is exposed as
  3100; in production it is exposed as 3000.

## Entry Points & Exports

+------------------+----------------+--------------------+---------------------+
| Service          | Internal Port  | Exposed Port (Dev) | Exposed Port (Prod) |
+------------------+----------------+--------------------+---------------------+
| Postgres         | 5432           | 5432               | 5432                |
| Redis            | 6379           | 6379               | 6379                |
| OTel Collector   | 4317, 4318     | ── commented out   | ── commented out    |
| Jaeger           | 16686          | ── commented out   | ── commented out    |
| Prometheus       | 9090           | ── commented out   | ── commented out    |
| Grafana          | 3000           | ── commented out   | ── commented out    |
| Agent            | 3001           | 3001               | 3001                |
| Backend          | 8080           | 8080               | 8080                |
| Frontend         | 3000           | **3002** (dev)     | **3000** (prod)     |
+------------------+----------------+--------------------+---------------------+

> **Note:** ChromaDB and RabbitMQ are documented in the architecture but are
> not currently present in any Docker Compose file. The observability stack
> (OTel Collector, Jaeger, Prometheus, Grafana) is defined but commented out
> in all compose files — enable by uncommenting and setting `ENABLE_OTEL=true`.

> **Lifecycle worker [Active]**: no new container. The consolidation/decay

> worker runs **in-process** inside `echo-backend` (goroutine + Redis SETNX
> lock). Redis pub/sub remains the future bridge toward an external job queue
> (NATS/Kafka) if horizontal autoscaling is ever required — at that point the
> worker job bodies move to a queue consumer with no logic change.

## Dependencies

### Base (`docker-compose.yml`)

```yaml
services:
  postgres:       image: ankane/pgvector:latest
  redis:          image: redis:7-alpine
  # chroma:       not present in any compose file
  # rabbitmq:     not present in any compose file
  # otel-collector: commented out
  # jaeger:       commented out
  # prometheus:   commented out
  # grafana:      commented out
```

### Dev Overrides (`docker-compose.dev.yml`)

Builds application images from source with **bind-mount volumes** for hot-reload:

+------------------+----------------------+----------------------------------+------------------------------------------+
| Service          | Build Context        | Command                          | Volumes                                  |
+------------------+----------------------+----------------------------------+------------------------------------------+
| migrate          | ./backend            | go run cmd/db/migrate/main.go    | ./backend:/app                           |
| seed             | ./backend            | go run cmd/db/seed/main.go       | ./backend:/app                           |
+------------------+----------------------+----------------------------------+------------------------------------------+

> **Note:** Application services (agent, backend, frontend) are not defined in
> `docker-compose.dev.yml` — they run directly on the host machine during
> development for faster hot-reload. Only infrastructure (postgres, redis) and
> migration/seed scripts are in the dev overlay.

**Environment differences from prod:**
- Backend: `ENABLE_OTEL=false` (disables tracing in dev)
- Frontend: `NEXT_PUBLIC_API_URL=http://localhost:8080`
- Backend uses raw `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  variables (not `DATABASE_URL`)

### Prod Overrides (`docker-compose.prod.yml`)

Builds application images from **Dockerfiles** with no bind-mounts:

+-----------+----------------------+-----------------------------+---------------------------+
| Service   | Build Context        | Dockerfile                  | Command                   |
+-----------+----------------------+-----------------------------+---------------------------+
| agent     | ./agent              | agent/Dockerfile            | bun src/index.ts          |
| backend   | ./backend            | backend/Dockerfile          | ./server (compiled Go     |
|           |                      |                             |   binary)                 |
| frontend  | ./frontend/web       | frontend/web/Dockerfile     | bun run start             |
+-----------+----------------------+-----------------------------+---------------------------+

**Environment differences from dev:**
- Backend: `ENABLE_OTEL=true`,
  `DATABASE_URL=postgresql://user:password@postgres:5432/echo_db?sslmode=disable`,
  `OTEL_COLLECTOR_ADDR=otel-collector:4317`
- Frontend: port **3000** (not 3002)

## Volume Mounts

+----------------------------------+--------+-----------------------------------+-------------+
| Volume                           | Driver | Mounts                            | Used By     |
+----------------------------------+--------+-----------------------------------+-------------+
| postgres_data                    | local  | /var/lib/postgresql/data          | postgres    |
| ./infra/otel-collector-config.yaml | bind | /etc/otel-collector-config.yaml   | otel-       |
|                                  |        |                                   | collector   |
| ./infra/prometheus.yml           | bind   | /etc/prometheus/prometheus.yml    | prometheus  |
| ./infra/grafana/provisioning     | bind   | /etc/grafana/provisioning         | grafana     |
| ./backend/scripts/init-pgvector.sql | bind | /docker-entrypoint-initdb.d/     | postgres    |
|                                  |        |   init-pgvector.sql               |             |
| ./backend/scripts/init-nuq.sql   | bind   | /docker-entrypoint-initdb.d/      | postgres    |
|                                  |        |   init-nuq.sql                    |             |
+----------------------------------+--------+-----------------------------------+-------------+

## Environment Injection

Environment variables flow through three mechanisms:

1. **Static env blocks** — declared inline in compose files (e.g., `POSTGRES_USER`,
   `REDIS_URL`, `INTERNAL_AUTH_TOKEN`)
2. **Dockerfile `ENV`** — baked into images (e.g., `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
   in agent Dockerfile)
3. **Docker DNS / Compose service names** — all services resolve each other by
   **service name** (e.g., `redis`, `postgres`). The `agent` service
   additionally uses `extra_hosts: host.docker.internal:host-gateway` to reach the
   host machine's LLM server.

## Source References

+---------------------------------------------+------------------------------------------------------+
| File                                        | Purpose                                              |
+---------------------------------------------+------------------------------------------------------+
| docker-compose.yml                          | Infrastructure base — databases, Redis               |
| docker-compose.dev.yml                      | Dev overlay — migrate/seed scripts                   |
| docker-compose.prod.yml                     | Prod overlay — pre-built Docker images               |
| backend/Dockerfile                          | Multi-stage Go build → scratch deploy                |
| agent/Dockerfile                            | Bun runtime + Chromium for Playwright                |
| frontend/web/Dockerfile                     | Bun build → static export or Next.js server          |
| backend/scripts/init-pgvector.sql           | Postgres initial schema (vector extension,           |
|                                             |   tool_catalog)                                      |
| backend/scripts/init-nuq.sql                | Postgres initial schema (NUQ queue, cron jobs)       |
| infra/otel-collector-config.yaml            | OTel pipeline definition                             |
| infra/prometheus.yml                        | Prometheus scrape config                             |
| infra/grafana/provisioning/datasources/     | Grafana auto-provisioned datasources                 |
|   datasources.yml                           |                                                      |
+---------------------------------------------+------------------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
