================================================================================
  KUBERNETES — POD TOPOLOGY & MANIFEST REFERENCE
================================================================================
  Module    : Kubernetes
  Service   : Infrastructure
  Version   : 1.1
  Updated   : 2026-07-31 (deferred: KEDA event-driven autoscaling note)
================================================================================

## Description

The Kubernetes manifests define the Echo application runtime within a single
`default` namespace. Eight YAML files cover all application services (agent,
backend, frontend), data stores (Postgres, Redis), ingress routing,
observability (Prometheus, Grafana, Jaeger, OTel Collector), and ConfigMaps for
init SQL and collector configuration. Horizontal Pod Autoscaling (HPA) is
configured for the backend service.

## File Structure

+--------------------+-----------------------------------------------------------------+
| File               | Resources                                                       |
+--------------------+-----------------------------------------------------------------+
| agent.yaml         | Deployment + Service (port 3001). Env: PORT, REDIS_URL,      |
|                    |   LLM_MODEL_API_URL, INTERNAL_AUTH_TOKEN, STATE_BACKEND=     |
|                    |   backend, SERVICE_JWT_SECRET, BACKEND_URL, ENABLE_REDIS     |
| backend.yaml       | Deployment + Service + HPA (port 8080, cpu 70%)                 |
| frontend.yaml      | Deployment + Service (port 3000)                                |
| redis.yaml         | Deployment + Service (port 6379)                                |
| postgres.yaml      | ConfigMap (init SQL) + PVC + Deployment + Service (port 5432,   |
|                    |   1Gi)                                                          |
| ingress.yaml       | Ingress (kong, host: echo.local)                                |
| monitoring.yaml    | Jaeger + Prometheus + Grafana (Deployments + Services +         |
|                    |   ConfigMap)                                                    |
| otel-collector.yaml| ConfigMap + Deployment + Service (ports 4317, 4318, 8889)       |
+--------------------+-----------------------------------------------------------------+

## ASCII Flow Diagram — Pod-to-Pod Communication

                            ┌─────────────────┐
                            │    Ingress      │
                            │    kong         │
                            │  echo.local     │
                            └────────┬────────┘
                           /api      │       /
                    ┌─────────┘       │       └─────────┐
                    ▼                 │                 ▼
             ┌──────────────┐        │         ┌──────────────┐
             │ echo-backend │        │         │echo-frontend │
             │    :8080     │        │         │   :3000      │
             └──────┬──┬────┘        │         └──────────────┘
                    │  │             │
                    │  └─────────────┘  NEXT_PUBLIC_API_URL
                    │
         ┌──────────┼────────────────┐
         ▼          ▼                ▼
    ┌──────────┐ ┌──────────┐ ┌──────────────┐
    │echo-agent│ │echo-post │ │ echo-redis   │
    │  :3001   │ │gres:5432 │ │  :6379       │
    └────┬─────┘ └──────────┘ └──────────────┘
         │
         │  LLM call
         │  (host)
         ▼
    ┌──────────┐
    │ LLM host │
    │ (host)   │
    └──────────┘

         ┌──────────────────────────────────────────────────┐
         │              OBSERVABILITY PLANE                  │
         │                                                   │
         │   ┌──────────────┐    OTLP    ┌──────────────┐   │
         │   │  App Pods    ├───────────►│  OTel Coll   │   │
         │   └──────────────┘ :4317/4318 │   :8889      │   │
         │                              └──────┬───────┘   │
         │                     ┌────────────────┼────┐      │
         │                     ▼                │    ▼      │
         │              ┌──────────────┐        │ ┌────────┐│
         │              │ echo-jaeger  │        │ │Prometh-││
         │              │   :16686     │        │ │ eus    ││
         │              └──────────────┘        │ │:9090   ││
         │                                      │ └───┬────┘│
         │                                      │     │      │
         │                                      │     ▼      │
         │                                      │ ┌────────┐ │
         │                                      │ │Grafana │ │
         │                                      │ │ :3000  │ │
         │                                      │ └────────┘ │
         └──────────────────────────────────────────────────────┘

## Entry Points & Services

+-----------------------+-------------+---------------------+------------------------+
| Service               | Cluster IP  | Port(s)             | Selector               |
+-----------------------+-------------+---------------------+------------------------+
| echo-agent            | 3001        | 3001                | app: echo-agent        |
| echo-backend          | 8080        | 8080                | app: echo-backend      |
| echo-frontend         | 3000        | 3000                | app: echo-frontend     |
| echo-redis            | 6379        | 6379                | app: echo-redis        |
| echo-postgres         | 5432        | 5432                | app: echo-postgres     |
| echo-otel-collector   | 4317/4318/  | gRPC, HTTP, metrics | app: echo-otel-        |
|                       | 8889        |                     |   collector            |
| echo-jaeger           | 16686, 4317 | UI, OTLP gRPC       | app: echo-jaeger       |
| echo-prometheus       | 9090        | 9090                | app: echo-prometheus   |
| echo-grafana          | 3000        | 3000                | app: echo-grafana      |
+-----------------------+-------------+---------------------+------------------------+

## Dependencies & Communication

+------------------+------------------------+--------------+------------------------------+
| Caller           | Target                 | Protocol     | Purpose                      |
+------------------+------------------------+--------------+------------------------------+
| Frontend         | Backend                | HTTP/REST    | API calls via ingress /api   |
| Backend          | Agent                  | HTTP         | Agent orchestration          |
| Backend          | Postgres               | PostgreSQL   | Application data + NUQ queue |
| Backend          | Redis                  | Redis        | Caching / sessions           |
| Agent            | Backend                | HTTP         | Agent state via backend      |
|                  |                        |              |   (STATE_BACKEND=backend —   |
|                  |                        |              |   memory endpoints, not Redis)|
| Agent            | LLM (host)             | HTTP         | Inference (localhost:1234)   |
| All app pods     | OTel Collector         | OTLP gRPC    | Traces & metrics             |
| OTel Collector   | Jaeger                 | OTLP gRPC    | Trace forwarding             |
| OTel Collector   | Prometheus             | HTTP (pull)  | Metrics exposition (:8889)   |
| Grafana          | Prometheus             | HTTP         | Datasource queries           |
| Grafana          | Jaeger                 | HTTP         | Trace exploration            |
+------------------+------------------------+--------------+------------------------------+

## Resource Limits

+-------------+-------------+-----------+-----------------+---------------+----------+
| Deployment  | CPU Request | CPU Limit | Memory Request  | Memory Limit  | Replicas |
+-------------+-------------+-----------+-----------------+---------------+----------+
| Backend     | 100m        | 500m      | 128Mi           | 512Mi         | 1-10     |
|             |             |           |                 |               | (HPA @   |
|             |             |           |                 |               |  70% CPU)|
| All others  | —           | —         | —               | —             | 1        |
+-------------+-------------+-----------+-----------------+---------------+----------+

### HorizontalPodAutoscaler (`echo-backend-hpa`)
- Target: Backend deployment
- Min pods: 1, Max pods: 10
- Metric: CPU utilization @ 70%

> **Worker & scaling note [Active]**: the lifecycle worker runs in-process in

> the backend pod (single instance via Redis SETNX lock), so HPA must not
> scale the backend below/above without the lock — the lock guarantees
> single-executor regardless of replica count.
> **KEDA / event-driven autoscaling is deferred** (not a current requirement).
> If adopted later, the worker job bodies move to a queue consumer
> (NATS/Kafka), and KEDA scales on queue depth — no logic change in the jobs.
> Bridge today: Redis (already used for the gateway's cross-instance session
> turn lock in SaaS mode).

## ConfigMaps

+--------------------------+----------------------------+-----------------------+-----------------------------------+
| ConfigMap                | Key                        | Mounted By            | Mount Path                        |
+--------------------------+----------------------------+-----------------------+-----------------------------------+
| postgres-init-sql        | init-pgvector.sql          | echo-postgres         | /docker-entrypoint-initdb.d/      |
| otel-collector-config    | otel-collector-config.yaml | echo-otel-collector   | /etc/otel-collector-config.yaml   |
| prometheus-config        | prometheus.yml             | echo-prometheus       | /etc/prometheus/prometheus.yml    |
+--------------------------+----------------------------+-----------------------+-----------------------------------+

## PersistentVolumeClaims

+---------------+------+----------------+-----------------+----------------------------+
| PVC           | Size | Access Mode    | Mounted By      | Mount Path                 |
+---------------+------+----------------+-----------------+----------------------------+
| postgres-pvc  | 1Gi  | ReadWriteOnce  | echo-postgres   | /var/lib/postgresql/data   |
+---------------+------+----------------+-----------------+----------------------------+

## Ingress

```
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: echo-ingress
  annotations:
    kubernetes.io/ingress.class: kong
    konghq.com/strip-path: "false"
spec:
  rules:
  - host: echo.local
    http:
      paths:
      - path: /api     -> backend service :8080
      - path: /        -> frontend service :3000
```

The Kong ingress controller routes `/api/*` to the Go backend and `/` to the
Next.js frontend.

## Source References

+--------------------+-----------------------------------------------------------+
| File               | Resources                                                 |
+--------------------+-----------------------------------------------------------+
| agent.yaml         | Deployment, Service (INTERNAL_AUTH_TOKEN, STATE_BACKEND=    |
|                    |   backend, SERVICE_JWT_SECRET, BACKEND_URL env)              |
| backend.yaml       | Deployment, Service, HorizontalPodAutoscaler (SERVICE_JWT_   |
|                    |   SECRET env)                                                |
| frontend.yaml      | Deployment, Service                                       |
| redis.yaml         | Deployment, Service                                       |
| postgres.yaml      | ConfigMap, PersistentVolumeClaim, Deployment, Service     |
| ingress.yaml       | Ingress (Kong)                                            |
| monitoring.yaml    | Jaeger (Deployment, Service), Prometheus (ConfigMap,      |
|                    |   Deployment, Service), Grafana (Deployment, Service —    |
|                    |   no datasource provisioning: Grafana's auto-provisioned  |
|                    |   datasources (./infra/grafana/provisioning) are mounted |
|                    |   only in the Docker Compose setup, not in K8s)           |
| otel-collector.yaml| ConfigMap, Deployment, Service                            |
+--------------------+-----------------------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
