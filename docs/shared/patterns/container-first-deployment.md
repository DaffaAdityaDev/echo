================================================================================
  CONTAINER-FIRST DEPLOYMENT
================================================================================
  Module    : Container-First Deployment
  Service   : Shared / Patterns
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Container-first architecture using Docker Compose for development and
production, with Kubernetes manifests for production orchestration.
Multi-stage builds for Go, Bun-based Node.js runtime for agent, and Next.js
static export for frontend.

## File Structure

+-----------------------------+-------------------------------------------------------+
| File / Directory            | Purpose                                               |
+-----------------------------+-------------------------------------------------------+
| docker-compose.yml          | Base infrastructure (PostgreSQL, Redis, Observability)|
| docker-compose.dev.yml      | Dev overrides (hot-reload, volume mounts)             |
| docker-compose.prod.yml     | Prod overrides (build from source, OTEL enabled)      |
| backend/Dockerfile          | Multi-stage Go build -> alpine:latest                 |
| agent/Dockerfile            | bun:1-alpine with Chromium for Playwright             |
| frontend/web/Dockerfile     | bun:1-alpine build -> bun run start                   |
| infra/k8s/                  |                                                        |
|   backend.yaml              | Deployment, Service, HPA                              |
|   agent.yaml                | Deployment, Service                                   |
|   frontend.yaml             | Deployment, Service                                   |
|   postgres.yaml             | ConfigMap (init SQL), PVC, Deployment, Service        |
|   redis.yaml                | Deployment, Service                                   |
|   chroma.yaml               | PVC, Deployment, Service (port 8000, 1Gi)              |
|   otel-collector.yaml       | ConfigMap, Deployment, Service (ports 4317, 4318, 8889)|
|   monitoring.yaml           | Jaeger + Prometheus + Grafana (Deployments + Services) |
|   ingress.yaml              | Kong Ingress (echo.local)                             |
+-----------------------------+-------------------------------------------------------+

## Docker Compose Architecture

┌──────────────────────────────────────────────────────────────────────────────────────┐
│                            DOCKER COMPOSE NETWORK                                      │
│                                                                                       │
│   ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐             │
│   │    postgres      │     │     redis        │     │    chroma        │             │
│   │    :5432         │     │    :6379         │     │    :8000         │             │
│   │    ankane/       │     │    redis:7-       │     │    chromadb/     │             │
│   │    pgvector      │     │    alpine         │     │    chroma        │             │
│   └──────────────────┘     └──────────────────┘     └──────────────────┘             │
│           │                       │                        │                          │
│           └───────────┬───────────┴───────────┬────────────┘                          │
│                       │                       │                                       │
│                       ▼                       ▼                                       │
│              ┌────────────────────┐  ┌────────────────────┐                           │
│              │    Go Backend      │  │    Hono Agent      │                           │
│              │    :8080           │  │    :3001           │                           │
│              │    Fiber Gateway   │  │    Bun Runtime     │                           │
│              └────────────────────┘  └────────────────────┘                           │
│                       │                       │                                       │
│                       └───────────┬───────────┘                                       │
│                                   │                                                   │
│                                   ▼                                                   │
│                          ┌────────────────────┐                                      │
│                          │    Next.js         │                                      │
│                          │    Frontend        │                                      │
│                          │    :3002 (dev)     │                                      │
│                          │    :3000 (prod)    │                                      │
│                          └────────────────────┘                                      │
│                                                                                       │
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│   │  OTel Collector  │  │    Jaeger        │  │   Prometheus    │  │   Grafana    │  │
│   │                  │  │    :16686        │  │   :9090         │  │   :3100      │  │
│   └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────┘

## Dockerfiles

### Go Backend (Multi-stage)

```dockerfile
# Build Stage
FROM golang:alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# Final Stage
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 8080
CMD ["./server"]
```

### Agent

```dockerfile
FROM oven/bun:1-alpine
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
EXPOSE 3001
CMD ["bun", "src/index.ts"]
```

### Frontend

```dockerfile
FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun run build
EXPOSE 3000
CMD ["bun", "run", "start"]
```

## Kubernetes Architecture

┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              KUBERNETES CLUSTER                                         │
│                                                                                       │
│   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐                 │
│   │     Ingress      │   │    Services       │   │     HPA          │                 │
│   │   ──────────────┐│   │   ─────────────┐  │   │   ─────────────┐│                 │
│   │   Kong          ││   │   backend      │  │   │   backend      ││                 │
│   │   echo.local    ││   │   agent        │  │   │   CPU 70%      ││                 │
│   │                 ││   │   frontend     │  │   │   1-10         ││                 │
│   └────────┬────────┘│   └────────┬───────┘  │   └───────────────┘│                 │
│            │         │            │           │                    │                 │
│            ▼         │            ▼           │                    │                 │
│   ┌──────────────────┐   ┌────────────────────────────────────┐   │                 │
│   │  /api -> backend │   │  Pods                              │   │                 │
│   │  /    -> frontend│   │  ┌────────────────┐ ┌────────────┐ │   │                 │
│   └──────────────────┘   │  │   backend      │ │   agent    │ │   │                 │
│                          │  │   :8080        │ │   :3001    │ │   │                 │
│                          │  └────────────────┘ └────────────┘ │   │                 │
│                          │  ┌────────────────┐                │   │                 │
│                          │  │   frontend     │                │   │                 │
│                          │  │   :3000        │                │   │                 │
│                          │  └────────────────┘                │   │                 │
│                          └────────────────────────────────────┘   │                 │
│                                                                                       │
│   ┌────────────────────────────────────────────────────────┐                         │
│   │  Persistent Volumes                                     │                         │
│   │  ┌──────────────────┐  ┌────────────────────────────┐  │                         │
│   │  │ postgres         │  │ ConfigMap: init SQL         │  │                         │
│   │  │ PVC 1Gi          │  │ init-pgvector.sql           │  │                         │
│   │  └──────────────────┘  └────────────────────────────┘  │                         │
│   └────────────────────────────────────────────────────────┘                         │
└──────────────────────────────────────────────────────────────────────────────────────┘

### K8s Resource Specs

+-----------+----------+-------------+---------------+-----------+-------------+-----------+
| Component | Replicas | CPU Request | Memory Request| CPU Limit | Memory Limit| HPA       |
+-----------+----------+-------------+---------------+-----------+-------------+-----------+
| backend   | 1        | 100m        | 128Mi         | 500m      | 512Mi       | Yes (70%  |
|           |          |             |               |           |             |   CPU,    |
|           |          |             |               |           |             |   1-10)   |
| agent     | 1        | (default)   | (default)     | (default) | (default)   | No        |
| frontend  | 1        | (default)   | (default)     | (default) | (default)   | No        |
| postgres  | 1        | (default)   | (default)     | (default) | (default)   | No        |
| redis     | 1        | (default)   | (default)     | (default) | (default)   | No        |
+-----------+----------+-------------+---------------+-----------+-------------+-----------+

## Service Dependencies

```
Startup Order:
  1. postgres       -> (init SQL + pgvector)
  2. redis          -> (state store + pub/sub)
  3. chroma         -> (RAG vector DB)
  4. agent          -> (depends on redis)
  5. backend        -> (depends on postgres + agent)
  6. frontend       -> (depends on backend)
  7. otel-collector -> (depends on nothing)
  8. jaeger         -> (depends on otel-collector)
  9. prometheus     -> (depends on nothing)
  10. grafana       -> (depends on prometheus)
```

## Build Pipelines

### Local Development

```bash
# Start everything
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Services with hot-reload:
#   agent:     volume mounts, bun run dev
#   backend:   volume mounts, go run cmd/server/main.go
#   frontend:  volume mounts, bun run dev
```

### Production Build

```bash
# Build all images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### K8s Deploy

```bash
# Apply infrastructure first
kubectl apply -f infra/k8s/postgres.yaml
kubectl apply -f infra/k8s/redis.yaml

# Then services
kubectl apply -f infra/k8s/backend.yaml
kubectl apply -f infra/k8s/agent.yaml
kubectl apply -f infra/k8s/frontend.yaml

# Then ingress
kubectl apply -f infra/k8s/ingress.yaml
```

## Entry Points & Exports

- **Docker Compose base**: `docker-compose.yml`
- **Docker Compose dev**: `docker-compose.dev.yml`
- **Docker Compose prod**: `docker-compose.prod.yml`
- **Go Dockerfile**: `backend/Dockerfile`
- **Agent Dockerfile**: `agent/Dockerfile`
- **Frontend Dockerfile**: `frontend/web/Dockerfile`
- **K8s manifests**: `infra/k8s/`

## Source References

+---------------------------------------------+-------+--------------------------------------+
| File                                        | Lines | Role                                 |
+---------------------------------------------+-------+--------------------------------------+
| docker-compose.yml                          | 1-84  | Infrastructure services (postgres,   |
|                                             |       |   chroma, redis, rabbitmq, otel,     |
|                                             |       |   jaeger, prometheus, grafana)       |
| docker-compose.dev.yml                      | 1-67  | Dev service definitions (agent,      |
|                                             |       |   backend, frontend)                 |
| docker-compose.prod.yml                     | 1-56  | Production service definitions       |
| backend/Dockerfile                          | 1-14  | Multi-stage Go build                 |
| agent/Dockerfile                            | 1-19  | Bun + Chromium                       |
| frontend/web/Dockerfile                     | 1-9   | Next.js static build                 |
| infra/k8s/backend.yaml                      | 1-79  | Go backend K8s manifest              |
| infra/k8s/agent.yaml                        | 1-44  | Agent K8s manifest                   |
| infra/k8s/frontend.yaml                     | 1-36  | Frontend K8s manifest                |
| infra/k8s/postgres.yaml                     | 1-89  | PostgreSQL with pgvector init        |
| infra/k8s/redis.yaml                        | 1-33  | Redis K8s manifest                   |
| infra/k8s/ingress.yaml                      | 1-27  | Kong Ingress routing                 |
+---------------------------------------------+-------+--------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
