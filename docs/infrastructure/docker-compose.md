================================================================================
  DOCKER COMPOSE — SERVICE TOPOLOGY & ORCHESTRATION
================================================================================
  Module    : Docker Compose
  Service   : Infrastructure
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

The Docker Compose stack defines the entire Echo application runtime: three data
stores (Postgres, Redis, ChromaDB), a message broker (RabbitMQ), a full
observability pipeline (OTel Collector → Prometheus/Grafana/Jaeger), and the
three application services (agent, backend, frontend). Base composition
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
│                  │   ChromaDB   │    │   RabbitMQ   │                                 │
│                  │    :8000     │    │    :5672     │                                 │
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
| ChromaDB         | 8000           | 8000               | 8000                |
| Redis            | 6379           | 6379               | 6379                |
| RabbitMQ         | 5672           | 5672               | 5672                |
| OTel Collector   | 4317, 4318     | 4317, 4318         | 4317, 4318          |
| Jaeger           | 16686          | 16686              | 16686               |
| Prometheus       | 9090           | 9090               | 9090                |
| Grafana          | 3000           | **3100**           | 3000                |
| Agent            | 3001           | 3001               | 3001                |
| Backend          | 8080           | 8080               | 8080                |
| Frontend         | 3000           | **3002** (dev)     | **3000** (prod)     |
+------------------+----------------+--------------------+---------------------+

> **Note:** Infrastructure services (ChromaDB, Redis, RabbitMQ, OTel Collector,
>   Jaeger, Prometheus, Grafana) inherit their port mappings from the base
>   `docker-compose.yml`. In production deployments, these ports should be
>   restricted by firewall or removed by overriding the base compose file.

## Dependencies

### Base (`docker-compose.yml`)

```yaml
services:
  postgres:       image: ankane/pgvector:latest
  chroma:         image: chromadb/chroma:latest
  redis:          image: redis:7-alpine
  rabbitmq:       image: rabbitmq:3-alpine
  otel-collector: image: otel/opentelemetry-collector-contrib:latest
  jaeger:         image: jaegertracing/all-in-one:latest
  prometheus:     image: prom/prometheus:latest
  grafana:        image: grafana/grafana:latest  # depends_on: prometheus
```

### Dev Overrides (`docker-compose.dev.yml`)

Builds application images from source with **bind-mount volumes** for hot-reload:

+-----------+----------------------+----------------------------------+------------------------------------------+
| Service   | Build Context        | Command                          | Volumes                                  |
+-----------+----------------------+----------------------------------+------------------------------------------+
| agent     | ./agent              | bun run dev                      | ./agent:/app (anon node_modules)         |
| backend   | golang:alpine (image)| go run cmd/server/main.go        | ./backend:/app                           |
| frontend  | ./frontend/web       | bun run dev                      | ./frontend/web:/app (anon node_modules,  |
|           |                      |                                  |   .next)                                 |
+-----------+----------------------+----------------------------------+------------------------------------------+

**Environment differences from prod:**
- Backend: `ENABLE_OTEL=false` (disables tracing in dev)
- Agent: `OTEL_COLLECTOR_ADDR=otel-collector:4317` (still sends traces)
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
| chroma_data                      | local  | /chroma/chroma                    | chroma      |
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
| docker-compose.yml                          | Infrastructure base — databases, message broker,     |
|                                             |   observability                                      |
| docker-compose.dev.yml                      | Dev overlay — hot-reload, source mounts              |
| docker-compose.prod.yml                     | Prod overlay — pre-built Docker images               |
| Makefile                                    | Targets: dev-up, dev-down, prod-up, prod-down,       |
|                                             |   deploy, status, clean                              |
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
