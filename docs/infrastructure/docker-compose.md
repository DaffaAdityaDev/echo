================================================================================
  DOCKER COMPOSE — SERVICE TOPOLOGY & ORCHESTRATION
================================================================================
  Module    : Docker Compose
  Service   : Infrastructure
  Version   : 1.1
  Updated   : 2026-07-31 (planned: in-process lifecycle worker note)
================================================================================

## Description

The Docker Compose stack defines the Echo application runtime. The base
composition (`docker-compose.yml`) defines ALL application services
(echo-agent, echo-backend, echo-frontend) PLUS the data stores (Postgres,
Redis) and the migration/seed jobs (echo-migrate, echo-seed). The dev
override (`docker-compose.dev.yml`) is infrastructure-only — it re-declares
just postgres, redis, migrate, and seed (for local development against host-
run app processes). The prod override (`docker-compose.prod.yml`) layers
env/builder overrides on top of the base file. The observability pipeline
(OTel Collector → Prometheus/Grafana/Jaeger) exists only as commented-out
blocks in both compose files.

## File Structure

+----------------------------+--------------------------------------------------------+
| File                       | Purpose                                                |
+----------------------------+--------------------------------------------------------+
| docker-compose.yml         | Base — all app services + postgres + redis + migrate + |
|                            |   seed; observability commented out                    |
| docker-compose.dev.yml     | Infra-only override — postgres/redis/migrate/seed for  |
|                            |   local development                                    |
| docker-compose.prod.yml    | Prod override — env defaults, no published DB ports    |
| Makefile                   | Orchestration targets (dev-up, prod-down, etc.)        |
+----------------------------+--------------------------------------------------------+

## ASCII Flow Diagram — Full Service Topology

┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              DOCKER NETWORK                                           │
│                                                                                       │
│  ┌────────────────┐    HTTP/3000    ┌────────────────┐    HTTP/8080                   │
│  │   Frontend     │ ◄──────────────►│    Backend     │ ◄────────────────────────────┐ │
│  │    :3000       │  NEXT_PUBLIC    │    :8080       │                              │ │
│  └────────────────┘    API_URL      └───────┬────────┘                              │ │
│                                             │                                        │ │
│                        ┌────────────────────┼────────────────────┐                   │ │
│                        ▼                    ▼                    ▼                   │ │
│                  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │ │
│                  │ echo-postgres│    │  echo-redis  │    │  echo-agent  │           │ │
│                  │    :5432     │    │    :6379     │    │    :3001     │           │ │
│                  │   pgvector   │    │   sessions   │    │   LLM call   │───────────┘ │
│                  └──────────────┘    └──────────────┘    └──────────────┘             │
│                                                                                       │
│                  ┌──────────────┐    ┌──────────────┐                                 │
│                  │  ChromaDB    │    │  RabbitMQ    │                                 │
│                  │  (not in any│    │  (not in any │                                 │
│                  │   compose)   │    │   compose)   │                                 │
│                  └──────────────┘    └──────────────┘                                 │
│                                                                                       │
│                  ┌──────────────────────────────────────────────┐                     │
│                  │ Observability (commented out in compose):    │                     │
│                  │ Jaeger ◄─ OTel Collector ─► Prometheus ─►    │                     │
│                  │ Grafana                                      │                     │
│                  └──────────────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────────────────────────────┘

> **Note:** Observability services (OTel Collector, Jaeger, Prometheus,
> Grafana) are only defined as commented-out blocks in the compose files —
> they are NOT running by default.

## Entry Points & Exports

+------------------+----------------+--------------------+---------------------+
| Service          | Internal Port  | Exposed Port (Dev) | Exposed Port (Prod) |
+------------------+----------------+--------------------+---------------------+
| Postgres         | 5432           | 5432               | ── not published    |
| Redis            | 6379           | 6379               | ── not published    |
| OTel Collector   | 4317, 4318     | ── commented out   | ── commented out    |
| Jaeger           | 16686          | ── commented out   | ── commented out    |
| Prometheus       | 9090           | ── commented out   | ── commented out    |
| Grafana          | 3000           | ── commented out   | ── commented out    |
| Agent            | 3001           | 3001               | 3001                |
| Backend          | 8080           | 8080               | 8080                |
| Frontend         | 3000           | **3000** (base)    | **3000** (prod)     |
+------------------+----------------+--------------------+---------------------+

> **Note:** ChromaDB and RabbitMQ are documented in the architecture but are
> not present in any Docker Compose file (ChromaDB appears only in the K8s
> manifests and is unused by code; RabbitMQ exists nowhere). The observability
> stack (OTel Collector, Jaeger, Prometheus, Grafana) is defined but commented
> out in all compose files — enable by uncommenting and setting
> `ENABLE_OTEL=true`.

> **Lifecycle worker [Active]**: no new container. The consolidation/decay

> worker runs **in-process** inside `echo-backend` (goroutine + Redis SETNX
> lock). Redis pub/sub remains the future bridge toward an external job queue
> (NATS/Kafka) if horizontal autoscaling is ever required — at that point the
> worker job bodies move to a queue consumer with no logic change.

## Dependencies

### Base (`docker-compose.yml`)

Defines ALL services:

```yaml
services:
  echo-postgres:  image: ankane/pgvector:latest   # + init scripts
  echo-redis:     image: redis:7-alpine
  echo-migrate:   build ./backend (builder)       # command ["./migrate"]
  echo-seed:      build ./backend (builder)       # command ["./seed"]
  echo-agent:     build ./agent
  echo-backend:   build ./backend (runner)
  echo-frontend:  build ./frontend/web
  # echo-otel-collector / echo-jaeger / echo-prometheus / echo-grafana: commented out
```

### Dev Overrides (`docker-compose.dev.yml`)

Infra-only overlay — re-declares ONLY postgres, redis, migrate, seed (with
published ports for host-run development). Application services run directly
on the host machine during development.

+------------------+----------------------+----------------------------------+------------------------------------------+
| Service          | Build Context        | Command                          | Volumes                                  |
+------------------+----------------------+----------------------------------+------------------------------------------+
| migrate          | ./backend            | ./migrate (compiled binary,      | ── none (no bind mounts)                 |
|                  |  (builder target)    |   built in image)                |                                          |
| seed             | ./backend            | ./seed (compiled binary,         | ── none (no bind mounts)                 |
|                  |  (builder target)    |   built in image)                |                                          |
+------------------+----------------------+----------------------------------+------------------------------------------+

> **Note:** Application services (echo-agent, echo-backend, echo-frontend)
> are not defined in `docker-compose.dev.yml` — they run directly on the
> host machine during development for faster iteration. Only infrastructure
> (echo-postgres, echo-redis) and migration/seed jobs are in the dev overlay.
> Dev service hostnames are `echo-postgres` / `echo-redis` (not `postgres` /
> `redis`).

**Environment differences from prod:**
- Backend: `ENABLE_OTEL=false` (disables tracing in dev)
- Frontend: `NEXT_PUBLIC_API_URL=http://localhost:8080`
- Backend uses raw `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  variables (not `DATABASE_URL`)

### Prod Overrides (`docker-compose.prod.yml`)

Layers env overrides and published app ports on the base file:

+-----------+----------------------+-----------------------------+---------------------------+
| Service   | Build Context        | Dockerfile                  | Command                   |
+-----------+----------------------+-----------------------------+---------------------------+
| agent     | ./agent              | agent/Dockerfile            | bun dist/index.js         |
| backend   | ./backend            | backend/Dockerfile          | ./server (compiled Go     |
|           |                      |                             |   binary)                 |
| frontend  | ./frontend/web       | frontend/web/Dockerfile     | bun run start             |
+-----------+----------------------+-----------------------------+---------------------------+

**Environment differences from dev:**
- Backend: `ENABLE_OTEL=false` (default; observability commented out),
  `DATABASE_URL=postgresql://user:password@echo-postgres:5432/echo_db?sslmode=disable`
- Agent: `INTERNAL_AUTH_TOKEN` defaulted, `SERVICE_JWT_SECRET` defaulted,
  `BACKEND_URL=http://echo-backend:8080`
- No `OTEL_COLLECTOR_ADDR` / `ENABLE_OTEL=true` in prod — the prod file does
  not enable OTel.
- Postgres/Redis ports are NOT published in prod.

## Volume Mounts

+----------------------------------+--------+-----------------------------------+-------------+
| Volume                           | Driver | Mounts                            | Used By     |
+----------------------------------+--------+-----------------------------------+-------------+
| postgres_data                    | local  | /var/lib/postgresql/data          | echo-postgres |
| redis_data                       | local  | /data                             | echo-redis  |
| ./backend/scripts/init-pgvector.sql | bind | /docker-entrypoint-initdb.d/     | echo-postgres |
|                                  |        |   init-pgvector.sql               |             |
| ./backend/scripts/init-nuq.sql   | bind   | /docker-entrypoint-initdb.d/      | echo-postgres |
|                                  |        |   init-nuq.sql                    |             |
+----------------------------------+--------+-----------------------------------+-------------+

Commented-out observability mounts (present only inside the disabled
`# echo-otel-collector` / `# echo-prometheus` / `# echo-grafana` blocks):

+----------------------------------+--------+-----------------------------------+-------------+
| Volume                           | Driver | Mounts                            | Used By     |
+----------------------------------+--------+-----------------------------------+-------------+
| ./infra/otel-collector-config.yaml | bind | /etc/otel-collector-config.yaml  | otel-       |
|                                  |        |                                   | collector   |
| ./infra/prometheus.yml           | bind   | /etc/prometheus/prometheus.yml   | prometheus  |
| ./infra/grafana/provisioning     | bind   | /etc/grafana/provisioning        | grafana     |
+----------------------------------+--------+-----------------------------------+-------------+

## Environment Injection

Environment variables flow through three mechanisms:

1. **Static env blocks** — declared inline in compose files (e.g., `POSTGRES_USER`,
   `REDIS_URL`, `INTERNAL_AUTH_TOKEN`)
2. **Dockerfile `ENV`** — baked into images (e.g., `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
   in agent Dockerfile)
3. **Docker DNS / Compose service names** — all services resolve each other by
   **service name** (`echo-postgres`, `echo-redis`, `echo-agent`, ...).

No service uses `extra_hosts`. Note that `host.docker.internal` does NOT
resolve on Linux — the `LLM_MODEL_API_URL` default
(`http://host.docker.internal:1234/v1`) only works on Docker Desktop
(macOS/Windows); on Linux hosts point `LLM_MODEL_API_URL` at a reachable
host address explicitly.

## Source References

+---------------------------------------------+------------------------------------------------------+
| File                                        | Purpose                                              |
+---------------------------------------------+------------------------------------------------------+
| docker-compose.yml                          | Base — all app services + postgres + redis +         |
|                                             |   migrate + seed                                     |
| docker-compose.dev.yml                      | Infra-only overlay — echo-postgres/echo-redis/       |
|                                             |   echo-migrate/echo-seed                             |
| docker-compose.prod.yml                     | Prod overlay — env defaults, no published DB ports   |
| backend/Dockerfile                          | Multi-stage Go build → runner image                  |
| agent/Dockerfile                            | Bun runtime + Chromium for Playwright                |
| frontend/web/Dockerfile                     | Bun build → Next.js server                           |
| backend/scripts/init-pgvector.sql           | Postgres initial schema (vector extension,           |
|                                             |   tool_catalog)                                      |
| backend/scripts/init-nuq.sql                | Postgres initial schema (NUQ queue, cron jobs)       |
| infra/otel-collector-config.yaml            | OTel pipeline definition (commented-out services)    |
| infra/prometheus.yml                        | Prometheus scrape config (commented-out services)    |
| infra/grafana/provisioning/datasources/     | Grafana auto-provisioned datasources (commented-out  |
|   datasources.yml                           |   services)                                          |
+---------------------------------------------+------------------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
