# backend

Go API for Echo (Fiber v3, pgx, optional Redis). It owns users, sessions, settings and prompts. Each chat turn is forwarded to the agent service, and the backend relays the agent's SSE stream back to the web app.

## Run

```bash
cp .env.example .env     # then set the secrets, see below
go run ./cmd/server      # :8080, API reference at http://localhost:8080/api/docs
```

The schema in `internal/database/schema.go` is applied on every start. `cmd/db/migrate` applies it without starting the server. The SQL files in `migrations/` are kept for reference only and nothing runs them.

Create the first user by adding `ADMIN_PASSWORD=<something>` to `.env`, then:

```bash
go run ./cmd/db/seed    # admin@gmail.com; does not reset an existing password
```

## Configuration

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Postgres connection string. Defaults to `postgresql://localhost/echo_db`. |
| `JWT_SECRET` | Signs user access tokens. |
| `INTERNAL_AUTH_TOKEN` | Sent to the agent on every call; must match `agent/.env`. |
| `SERVICE_JWT_SECRET` | Verifies calls the agent makes to `/api/v1/internal/*`; must match `agent/.env`. |
| `ENCRYPTION_KEY` | Exactly 32 characters. Encrypts provider API keys at rest. |
| `AGENT_HTTP_URL` | Where the agent listens, default `http://localhost:3001`. The legacy `HONO_API_URL` overrides it if set. |
| `REDIS_ADDR` | Defaults to `localhost:6379`. Set it to an empty value to run without Redis. |
| `ENVIRONMENT` | `development` relaxes secret checks to warnings and allows private provider URLs. |
| `ALLOW_PRIVATE_PROVIDER_URLS` | Allow LM Studio or other localhost/LAN providers outside development. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated, defaults to localhost:3000. |

The secret variables must not be empty or left at the built-in defaults. In production, the `.env.example` placeholders and short values are rejected too. The worker, pruning and history limits (`WORKER_INTERVAL`, `PRUNE_*`, `HISTORY_*`, `SUMMARIZE_*`) default in `internal/config/config.go` and are listed, commented out, in `.env.example`.

## Layout

```
cmd/server        HTTP server entry point
cmd/db/{migrate,seed}
internal/router   route table and wiring
internal/handler  HTTP handlers, one package per area
internal/service  business logic
internal/repository  SQL access (queries in internal/constants/db; the memory handlers still query directly)
internal/worker   session consolidation and decay
api/docs          generated OpenAPI spec (make swagger-gen from the repo root)
```

## Tests

```bash
go test ./...
```

Repository tests use the database from `.env` and write test rows into it. They skip themselves when it is unreachable.

More notes: [`docs/backend`](../docs/backend/README.md).
