================================================================================
  MONITORING — OBSERVABILITY PIPELINE
================================================================================
  Module    : Monitoring
  Service   : Infrastructure
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

The monitoring stack documents the target observability pipeline via
OpenTelemetry (traces + metrics → OTel Collector → Prometheus + Jaeger), with
Grafana as the unified dashboard layer.

**IMPORTANT — current implementation status:**
- The Go backend OTLP export leg is **NOT implemented**. `ENABLE_OTEL` and
  `OTEL_COLLECTOR_ADDR` are loaded into the backend `Config`
  (internal/config/config.go:22-23) but never consumed — the backend has no
  OTel SDK exporter/tracer provider. The backend only uses
  `go.opentelemetry.io/otel/trace` for `traceparent` propagation across the
  Go → Agent HTTP calls.
- The Bun agent's telemetry goes to **Langfuse only** (via
  `@langfuse/otel` in shared/utils/telemetry.ts) — it does NOT emit to an
  OTLP collector.
- The collector/Prometheus/Jaeger/Grafana services exist only as
  commented-out blocks in Docker Compose and as K8s manifests; nothing is
  deployed by default.

## File Structure

+-----------------------------------------+--------------------------------------+
| File                                    | Purpose                              |
+-----------------------------------------+--------------------------------------+
| infra/otel-collector-config.yaml        | Receiver/processor/exporter pipeline |
| infra/prometheus.yml                    | Global config + scrape targets       |
| infra/grafana/provisioning/datasources/ | Auto-provisioned datasources         |
|   datasources.yml                       |                                      |
+-----------------------------------------+--------------------------------------+

## ASCII Flow Diagram — Data Pipeline

┌──────────────────────────────────────────────────────────────────────────────────────┐
│                               APPLICATION PODS                                        │
│                                                                                       │
│   ┌──────────────┐       ┌──────────────┐       ┌──────────────┐                     │
│   │    Agent     │       │   Backend    │       │   Frontend   │                     │
│   │   (Bun)      │       │    (Go)      │       │  (Next.js)   │                     │
│   └──────┬───────┘       └──────┬───────┘       └──────────────┘                     │
│          │                      │                                                     │
│          └──────────┬───────────┘                                                     │
│                     │ OTLP (gRPC :4317 / HTTP :4318)                                  │
└─────────────────────┼─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                           OPENTELEMETRY COLLECTOR                                      │
│                                                                                       │
│   Receivers:          │  Processors:  │  Exporters:                                   │
│   ┌────────────┐      │  ┌──────────┐ │  ┌───────────────────────────────────┐       │
│   │  OTLP gRPC │─────►│  │  Batch   │─►│  prometheus (:8889)                │       │
│   │   :4317    │      │  └──────────┘ │  │  namespace: agent_platform        │       │
│   ├────────────┤      │              │  ├───────────────────────────────────┤       │
│   │  OTLP HTTP │      │              │  │  otlp/jaeger                      │──►──► │
│   │   :4318    │      │              │  │  endpoint: jaeger:4317            │       │
│   └────────────┘      │              │  ├───────────────────────────────────┤       │
│                       │              │  │  logging (stdout)                 │       │
│                       │              │  └───────────────────────────────────┘       │
└───────────────────────┴──────────────┴──────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                               PIPELINE SPLIT                                           │
│                                                                                       │
│   Traces ────────────────────►  Jaeger (:16686)                                       │
│                                   │  Explore traces, dependencies                     │
│                                                                                       │
│   Metrics ───────────────────►  Prometheus (:9090)                                    │
│                                   │  5s scrape interval                               │
│                                   │  target: otel-collector:8889                      │
│                                                                                       │
└───────────────────────────────────┬───────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              GRAFANA (:3000)                                           │
│                                                                                       │
│   Datasources:                                                                        │
│     ┌──────────────────┐              ┌──────────────────┐                            │
│     │   Prometheus     │              │     Jaeger       │                            │
│     │   (default)      │              │                  │                            │
│     └──────────────────┘              └──────────────────┘                            │
│                                                                                       │
│   Dashboards:                                                                         │
│     - App metrics (latency, throughput, errors)                                       │
│     - Infrastructure (CPU, memory, queue depth)                                       │
│     - Trace exploration via Jaeger data source                                        │
└──────────────────────────────────────────────────────────────────────────────────────┘

## Entry Points & Exports

+------------------+-----------------+--------------------+-------------------------------+
| Component        | Port(s)         | Protocol           | Purpose                       |
+------------------+-----------------+--------------------+-------------------------------+
| OTel Collector   | 4317, 4318      | OTLP gRPC/HTTP     | Application signal ingestion  |
| OTel Collector   | 8889            | HTTP (Prometheus)  | Metrics exposition endpoint   |
| Prometheus       | 9090            | HTTP               | Metrics store & query         |
| Jaeger           | 16686           | HTTP               | Trace UI                      |
| Jaeger           | 4317            | OTLP gRPC          | Trace ingestion from OTel     |
| Grafana          | 3000            | HTTP               | Dashboards & alerting         |
+------------------+-----------------+--------------------+-------------------------------+

## Prometheus Scraping Targets

```yaml
# infra/prometheus.yml
global:
  scrape_interval: 5s
  evaluation_interval: 5s

scrape_configs:
  - job_name: 'otel-collector'
    static_configs:
      - targets: ['otel-collector:8889']
```

The OTel Collector exports metrics under the `agent_platform` namespace on
`:8889`. Prometheus scrapes this endpoint every 5 seconds. In Kubernetes, the
equivalent `prometheus-config` ConfigMap targets `echo-otel-collector:8889`.

## OTel Collector Pipeline

### Receivers
- **OTLP gRPC** (`0.0.0.0:4317`) — designed as primary ingestion. NOTE: no
  application service currently exports OTLP (Go backend OTLP export is not
  implemented; agent telemetry goes to Langfuse only)
- **OTLP HTTP** (`0.0.0.0:4318`) — alternative HTTP/protobuf ingestion for
  environments where gRPC is unavailable

### Processors
- **Batch** — groups spans/metrics before exporting to reduce downstream write
  pressure

### Exporters

+-----------------+----------------------+----------+-----------------------+
| Exporter        | Endpoint             | Data     | Namespace / TLS       |
+-----------------+----------------------+----------+-----------------------+
| prometheus      | 0.0.0.0:8889         | Metrics  | agent_platform        |
| otlp/jaeger     | jaeger:4317          | Traces   | tls.insecure: true    |
| logging         | stdout               | Both     | verbosity: basic      |
+-----------------+----------------------+----------+-----------------------+

### Pipelines

+----------+-----------+-----------+---------------------------+
| Pipeline | Receivers | Processor | Exporters                 |
+----------+-----------+-----------+---------------------------+
| traces   | [otlp]    | [batch]   | [otlp/jaeger, logging]    |
| metrics  | [otlp]    | [batch]   | [prometheus, logging]     |
+----------+-----------+-----------+---------------------------+

## Grafana Datasource Provisioning

```yaml
# infra/grafana/provisioning/datasources/datasources.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: Jaeger
    type: jaeger
    access: proxy
    url: http://jaeger:16686
    isDefault: false
```

Grafana auto-loads these datasources on startup via the
`./infra/grafana/provisioning` volume mount. Prometheus is the default
datasource; Jaeger is available for trace exploration.

## Alert Chain

Current stack has no alerting rules configured in Prometheus. The recommended
alert chain is:

Application Metrics (OTel)
         │
         ▼
  Prometheus (recording/alert rules)
         │
         ▼
   Alertmanager ──► Slack / PagerDuty / Email
         │
         ▼
   Grafana (visual alerting)

Alert rules would be added to `prometheus.yml` under `rule_files:` and a
dedicated `alertmanager.yml` configuration.

## Log Leg: Backend -> Loki -> Grafana (IMPLEMENTED)

In addition to the metrics/traces pipeline above, application logs are
aggregated by a separate, JVM-free stack defined in infra/observability/:

+-------------+--------------------------------------------------------------+
| Component   | Role                                                         |
+-------------+--------------------------------------------------------------+
| Loki        | Go single-binary log store (target all), TSDB schema, 30-day|
|             | retention, filesystem storage in the loki_data volume       |
| Grafana     | Dashboard + Loki datasource (auto-provisioned)              |
+-------------+--------------------------------------------------------------+

The backend pushes structured logs **directly** to Loki via the push API
(`/loki/api/v1/push`) through an asynchronous, fire-and-forget sink enabled
by the `LOKI_URL` env var (`backend/internal/pkg/logger/`). No Vector, no
Docker log driver, no files on disk: the backend container sets
`logging: driver: "none"` and records are dropped silently while Loki is
unreachable. Console logging stays the primary channel — human text in dev,
JSON in production — and `LOKI_URL` is optional (unset = console only, so
local development needs no external dependency).

The sink batches JSON lines (slog records + access log) and flushes every 5
seconds or 1 MB under fixed labels `service="echo-backend"` and
`stream="stdout"`. When `LOKI_URL` is set, the access log also switches to
JSON so both streams arrive parseable. Panic stack traces are logged as a
single JSON string field ("stack"), so no multiline parsing is needed. The
std log package is unused outside tests.

Quick start and example LogQL queries: infra/observability/README.md.
## Source References

+---------------------------------------------+------------------------------------------+
| File                                        | Purpose                                  |
+---------------------------------------------+------------------------------------------+
| infra/otel-collector-config.yaml            | Collector pipeline definition            |
| infra/prometheus.yml                        | Prometheus scrape configuration          |
| infra/grafana/provisioning/datasources/     | Grafana auto-provisioned datasources     |
|   datasources.yml                           |                                          |
| infra/k8s/otel-collector.yaml               | K8s ConfigMap + Deployment + Service     |
|                                             |   for collector                          |
| infra/k8s/monitoring.yaml                   | K8s manifests for Jaeger, Prometheus,    |
|                                             |   Grafana                                |
+---------------------------------------------+------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
