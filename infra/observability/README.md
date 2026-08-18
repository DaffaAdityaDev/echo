# Observability Stack (Logs: Backend -> Loki -> Grafana)

Low-footprint, JVM-free log aggregation for the Echo deployment:

| Service | Language | RAM (approx) | Role |
|---|---|---|---|
| Loki | Go (single binary) | 100-300 MB | Log storage + LogQL query |
| Grafana | Go | 50-150 MB | Dashboard + Loki datasource |

The Go backend pushes structured logs **directly** to Loki through the push
API (`/loki/api/v1/push`) via an asynchronous, fire-and-forget sink enabled
by the `LOKI_URL` env var. Nothing is written to disk and Docker logging is
fully bypassed (`logging: driver: "none"` on the backend): when Loki is
down, records are dropped silently and the application never blocks or
retries.

The app stays 12-factor: console logging (stdout/stderr) remains the primary
channel — human text in dev, JSON in production. `LOKI_URL` is optional:
unset, the backend logs to console only and needs no external dependency.

## Quick start

```bash
docker network create dokploy-network   # once, if missing
cd infra/observability
docker compose -f docker-compose.obs.yml up -d
```

- Grafana: http://localhost:3000 (admin / admin, or `GRAFANA_ADMIN_USER` /
  `GRAFANA_ADMIN_PASSWORD`)
- Loki API: http://localhost:3100

The stack shares the external `dokploy-network` so a backend container on it
can reach `http://loki:3100` by name. No port publishing is required for the
backend container; `3100` is published only for local (non-container) use.

## What gets shipped

The backend sink (`backend/internal/pkg/logger/`) batches JSON lines (slog
records + access log) and flushes every 5 seconds or 1 MB, with fixed labels:

- `service="echo-backend"`
- `stream="stdout"`

Console behavior is unchanged: dev = text, production = JSON. When
`LOKI_URL` is set, the access log switches to JSON as well so both streams
arrive as parseable JSON in Loki.

## Local development

```bash
# console only (default — no Loki involved)
go run ./cmd/server

# dev + Grafana (obs stack must be up)
$env:LOKI_URL="http://localhost:3100"; go run ./cmd/server
```

## Centralized / remote Loki

The backend only knows `LOKI_URL`, so pointing at a shared instance is a
config change, never a code change. Optional env vars (all empty by default,
so the pipeline is unchanged when unset):

| Env | Purpose |
|---|---|
| `LOKI_URL` | Push endpoint, e.g. `https://loki.corp.example.com` |
| `LOKI_USER` / `LOKI_PASSWORD` | HTTP Basic Auth |
| `LOKI_TENANT_ID` | Multi-tenant header `X-Scope-OrgID` |
| `LOKI_LABELS` | Extra stream labels, comma-separated `k=v` pairs, e.g. `tenant=acme,project=echo` |

```powershell
$env:LOKI_URL="https://loki.corp.example.com"
$env:LOKI_USER="svc-echo"
$env:LOKI_PASSWORD="secret"
$env:LOKI_TENANT_ID="acme"
$env:LOKI_LABELS="tenant=acme,project=echo"
go run ./cmd/server
```

Invalid `LOKI_LABELS` entries (no `=` or empty key) are dropped silently;
extra labels override the base `service`/`stream` labels on conflict.
Grafana needs its own datasource for the remote Loki (see
`grafana/provisioning/datasources/loki.yml`).

## Example LogQL queries

```
{service="echo-backend"} | json
{service="echo-backend"} | json | component="chat"
{service="echo-backend"} | json | level="ERROR"
{service="echo-backend"} | json | msg=~"panic"
```

## Retention

Loki is configured for 30 days (`retention_period: 720h` in
`loki-config.yml`). All state lives in the `loki_data` and `grafana_data`
volumes — remove them to reset the stack.

## Notes

- No JVM anywhere: Elasticsearch/Logstash/Kibana are intentionally not used.
- No Vector and no Docker log driver involvement: the pipeline is
  app -> Loki directly, so backend containers write nothing to disk.
- The existing `infra/` telemetry (OTel/Prometheus/Jaeger) is a separate,
  metrics/traces pipeline; this stack covers the log leg only.
