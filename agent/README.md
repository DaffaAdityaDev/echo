# agent

Bun + Hono service that runs the model loop for Echo. The backend calls it once per chat turn (`POST /api/v1/generate-mission`) with the conversation, the user's provider config and feature toggles. The agent streams events back over SSE: content, reasoning, tool calls, approvals and usage.

It does not store provider keys. They arrive with each request from the backend.

## Run

```bash
cp .env.example .env
bun run dev          # :3001, API reference at http://localhost:3001/docs
```

`INTERNAL_AUTH_TOKEN` and `SERVICE_JWT_SECRET` must match the backend's values. Every `/api/*` route requires the internal token, so only the backend can call it.

## What's inside

- `src/core/agent/harness` is the loop: turn runner, tool executor, loop and repeat detection, step/time/cost budget, context compaction, circuit breaker, and the human-approval guard for protected tools.
- `src/core/agent/tools` has the built-in tools (`web_search`, `write_todos`, `delegate_task`) and the registry.
- `src/infrastructure/providers` has the four providers: `openai`, `anthropic`, `lm-studio`, `opencode-go`.
- `src/infrastructure/transports` has the MCP client (`ENABLE_MCP`, `MCP_SERVER_URL`) and a REST tool adapter. The adapter only runs for missions that include `restTools`, and the backend does not send that field today.
- `src/adapter` holds the HTTP routes in, and the backend memory/prompt clients out.

Paused missions waiting for approval are stored in memory or, with `STATE_BACKEND=backend`, in the backend's memory API. Use `backend` whenever you run more than one agent instance.

## Configuration

| Variable | Notes |
|----------|-------|
| `PORT` | Default 3001. |
| `INTERNAL_AUTH_TOKEN` | Required. |
| `SERVICE_JWT_SECRET` | Signs calls to the backend's internal API. |
| `BACKEND_URL` | Default `http://localhost:8080`. |
| `STATE_BACKEND` | `memory` or `backend`. |
| `NODE_ENV` | Set to `production` in deployments. It hides raw error messages and rejects placeholder secrets. |
| `DEBUG_PROMPT` | Streams the full prompt to the client and writes it to `debug/`. Keep it off outside local debugging. |
| `REDIS_URL` | Optional prompt cache. |
| `LANGFUSE_*` | Optional tracing. Leave the dummy keys to disable it. |

## Tests

```bash
bun run test        # vitest
bunx tsc --noEmit
bun run lint        # oxlint
```

More notes: [`docs/agent`](../docs/agent/README.md).
