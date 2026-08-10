================================================================================
  ENVIRONMENT VARIABLE CONTRACT
================================================================================
  Module    : Environment Contract
  Service   : Shared / Contracts
   Version   : 1.4
   Updated   : 2026-08-05 (compose maps, config struct, PROMPT_TEMPLATE_NAME)
================================================================================

## Description

Required and optional environment variables per service, shared prefixes,
precedence rules, and default values. This contract ensures cross-service
compatibility and eliminates configuration drift.

## File Structure

+---------------------------------------+---------------------------------------------+
| File / Directory                      | Role                                        |
+---------------------------------------+---------------------------------------------+
| backend/.env.example                  | Backend env example                         |
| backend/.env                          | Backend env                                 |
| backend/internal/config/config.go     | Config struct loading from env              |
| backend/internal/constants/config/    | Default values                              |
|   defaults.go                         |                                             |
| backend/internal/models/config/config.go | Config struct definition                  |
| agent/.env.example                    | Agent env example                           |
| agent/.env                            | Agent env                                   |
| agent/src/config/env.schema.ts        | Zod env validation                          |
| agent/src/config/env.constants.ts     | Defaults and enum values                    |
| frontend/web/.env.local               | Frontend env                                |
+---------------------------------------+---------------------------------------------+

## Shared Prefixes

+-------------------+-----------------+--------------------------------------+
| Prefix            | Owner           | Description                          |
+-------------------+-----------------+--------------------------------------+
| DB_               | Compose / infra | Database connection parameters —     |
|                   |                 | consumed by migrate/seed containers  |
|                   |                 | only; the Go runtime never reads DB_*|
|                   |                 | (it uses DATABASE_URL)               |
| JWT_              | Go Backend      | User JWT signing configuration       |
| SERVICE_JWT_      | Go + Agent      | Service-to-service JWT secret        |
| REDIS_ / REDIS    | Go + Agent      | Redis connection; agent uses REDIS_URL for the mission event store |
| OTEL_             | Go Backend      | Loaded into config but unused        |
|                   |                 | (dead config)                        |
| LANGFUSE_         | Agent           | Langfuse observability credentials   |
| AGENT_ / HONO_    | Go Backend      | Agent service URL (HONO_API_URL      |
|                   |                 | takes precedence over AGENT_HTTP_URL)|
| BACKEND_          | Agent           | Backend internal URL (memory gw)     |
| LLM_              | Agent           | LLM model listing API                |
| INTERNAL_         | Go + Agent      | Cross-service auth token             |
| NEXT_PUBLIC_      | Frontend        | Client-side exposed env              |
+-------------------+-----------------+--------------------------------------+

## Go Backend (Fiber)

### env.example

```env
PORT=8080
DATABASE_URL=postgres://user:password@localhost:5432/echo_db?sslmode=disable
JWT_SECRET=replace-this-with-a-secure-secret
SERVICE_JWT_SECRET=change-this-to-a-secure-service-jwt-secret-min32chars
ENVIRONMENT=development
HONO_API_URL=http://localhost:3001   # preferred; AGENT_HTTP_URL is the fallback
AGENT_HTTP_URL=http://localhost:3001
ALLOW_ORIGINS=http://localhost:3000
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
ENABLE_OTEL=false                    # loaded but unused (dead config)
OTEL_COLLECTOR_ADDR=otel-collector:4317  # loaded but unused (dead config)
INTERNAL_AUTH_TOKEN=default-internal-token-secret

# Default model when user doesn't specify
DEFAULT_MODEL=opencode-go/deepseek-v4-flash

# Encryption key for user API key storage (must be exactly 32 characters for AES-256)
ENCRYPTION_KEY=change-this-to-a-32-char-key!!!!

# Lifecycle worker interval (Active)
WORKER_INTERVAL=15m

# Memory decay windows in days (Active)
DECAY_DEPRECATE_AFTER=30
DECAY_ARCHIVE_AFTER=90

# Default rollout % for a strategy_rollout entry that omits its value (Active),
# e.g. "0.1" = 10%. Unconfigured versions are never routed by rollout.
STRATEGY_ROLLOUT_DEFAULT=0.1
```


Provider API keys and base URLs removed from server-level config.
They are now per-user settings stored encrypted in the database (UserPreferences).

### Config Struct (internal/models/config/config.go)

```go
type Config struct {
    Port                string
    DatabaseURL         string
    JWTSecret           string
    Environment         string
    AgentHTTPURL        string
    AllowOrigins        string
    RedisAddr           string
    RedisPassword       string
    OtelCollectorAddr   string   // loaded but unused (dead config)
    EnableOtel          bool     // loaded but unused (dead config)
    InternalAuthToken   string
    DefaultModel        string
    ServiceJWTSecret    string
    PRUNE_THRESHOLD         int
    PRUNE_KEEP_LATEST_TURNS int
    SUMMARIZE_MAX_TOKENS    int
    EvaluatorEndpoint   string   // loaded but unused (dead config)
    EvaluatorAPIKey     string   // loaded but unused (dead config)
    EvaluatorModel      string   // loaded but unused (dead config)
    EncryptionKey       string
    StrategyRolloutDefault  float64
    PromptTemplateName      string   // default "" — fallback template name when app_settings has no mapping
    WorkerInterval          string   // e.g. "15m" — parsed lazily at use time
    DecayDeprecateAfter     int      // days
    DecayArchiveAfter       int      // days
}
```

> `ENABLE_OTEL` is parsed with a strict `== "true"` comparison
> (`config.go:23`) — any other value (including `"1"` or `"TRUE"`) means
> disabled.

### Defaults (Go)

```go
DefaultPort              = "8080"
DefaultDatabaseURL       = "postgresql://localhost/echo_db?sslmode=disable"
DefaultJWTSecret         = "your-secret-key"
DefaultServiceJWTSecret  = "default-service-jwt-secret"
DefaultEnvironment       = "development"
DefaultAgentHTTPURL      = "http://localhost:3001"
DefaultAllowOrigins      = "http://localhost:3000"
DefaultRedisAddr         = "localhost:6379"
DefaultRedisPass         = ""
DefaultModel             = "opencode-go/deepseek-v4-flash"
```

Note: PRUNE_THRESHOLD (100000), PRUNE_KEEP_LATEST_TURNS (10), and
SUMMARIZE_MAX_TOKENS (500) have inline defaults in config.go — no
corresponding named constants. ENCRYPTION_KEY has NO default in config.go:
it is read raw from the environment (`os.Getenv("ENCRYPTION_KEY")`), so an
unset key is empty and API key encryption fails at runtime with an explicit
log warning.

Lifecycle defaults (inline in config.go, implemented):
WORKER_INTERVAL (15m), DECAY_DEPRECATE_AFTER (30 days), DECAY_ARCHIVE_AFTER (90 days),
STRATEGY_ROLLOUT_DEFAULT (0.1).

PROMPT_TEMPLATE_NAME has no named default constant — it is read inline in
config.go (`envStr("PROMPT_TEMPLATE_NAME", "")`, default empty string). It
is the fallback prompt template name used when the `app_settings`
`prompt_template_name` mapping has neither a per-tenant entry nor a
"default" entry (see `docs/backend/application/features/governance.md`).

History/consolidation caps (inline defaults in config.go, implemented):
HISTORY_MAX_TOKENS (50000) — max tokens of session history forwarded to the
agent; HISTORY_MAX_MSG_CHARS (100000) — per-message content truncation in
history; CONSOLIDATION_SKIP_TOKENS (200000) — sessions above this total token
count skip auto-consolidation (e.g. 1M-context load-test sessions).

Provider defaults removed (DefaultOpenAIBaseURL, DefaultAnthropicBaseURL, DefaultLMStudioBaseURL).
Provider base URLs are now user-level defaults in service/aimodel/service.go / service/settings/service.go.

## Agent (Hono/Bun)

### env.example

```env
PORT=3001
GRPC_PORT=50051              # RESERVED — no gRPC code in the agent; kept for schema compatibility
CHROMA_URL=http://localhost:8000   # RESERVED — no ChromaDB client at runtime (chroma-retriever.md: PLANNED)
STATE_BACKEND=memory
INTERNAL_AUTH_TOKEN=default-internal-token-secret
SERVICE_JWT_SECRET=replace-this-with-a-different-secret
BACKEND_URL=http://localhost:8080
NODE_ENV=development
ENABLE_TELEMETRY=true        # Read by shared/utils/telemetry.ts (set "false" to skip OTel init)

# RESERVED — never read by any agent code (kept for schema compatibility):
# FIRECRAWL_URL=http://localhost:3005
# FIRECRAWL_API_KEY=

LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=http://localhost:3000

# LLM_MODEL_API_URL=http://localhost:1234  (read by agent GET /api/models proxy — model.controller.ts:9)
# MCP_SERVER_URL=http://localhost:3002/sse
ENABLE_MCP=false             # when true + MCP_SERVER_URL set: index.ts connects the MCP client (connectMCPServer)
ENABLE_REST_TOOLS=false      # RESERVED — schema-only; per-session REST tools are wired via config.restTools in mission.controller.ts

# Redis (optional — prompt template caching in the agent; the gateway uses it
# for skill-catalog caching and the cross-instance session turn lock)
REDIS_URL=redis://localhost:6379
```

### Env Schema (Zod)

```typescript
PORT:                    z.string().default("3001")
GRPC_PORT:               z.string().default("50051")   // RESERVED — no gRPC code
CHROMA_URL:              z.string().default("http://localhost:8000")  // RESERVED — no runtime client
LLM_MODEL_API_URL:       z.string().default("http://127.0.0.1:1234")  // Read by GET /api/models proxy
STATE_BACKEND:           z.enum(["memory", "backend"]).default("memory")
NODE_ENV:                z.enum(["development","production","test"]).default("development")
DEBUG_PROMPT:            z.coerce.boolean().default(false)
INTERNAL_AUTH_TOKEN:     z.string()              // REQUIRED (no default)
SERVICE_JWT_SECRET:      z.string().min(32).default("change-this-to...")
BACKEND_URL:             z.string().default("http://localhost:8080")
REDIS_URL:               z.string().url().default("redis://localhost:6379")  // Prompt cache + gateway session lock (optional)
MCP_SERVER_URL:          z.string().optional()   // MCP SSE endpoint — consumed at startup when ENABLE_MCP
ENABLE_MCP:              z.coerce.boolean().default(false)
ENABLE_REST_TOOLS:       z.coerce.boolean().default(false)  // RESERVED — schema-only, never read at runtime
ENABLE_TELEMETRY:        z.string().default("true")          // Read by shared/utils/telemetry.ts
LANGFUSE_PUBLIC_KEY:     z.string().default("pk-lf-dummy")
LANGFUSE_SECRET_KEY:     z.string().default("sk-lf-dummy")
LANGFUSE_BASE_URL:       z.string().default("http://localhost:3000")
AGENT_RUNTIME_MODE:      z.enum(["local","saas"]).default("local")
```

### Env Constants

```typescript
STATE_BACKENDS:   ["memory", "backend"] as const
ENVIRONMENTS:     ["development", "production", "test"] as const
RUNTIME_MODES:    ["local", "saas"] as const
```

## Frontend (Next.js)

+----------------------+----------+---------------------------+--------------------------------+
| Variable             | Required | Default                   | Description                    |
+----------------------+----------+---------------------------+--------------------------------+
| NEXT_PUBLIC_API_URL  | Yes      | http://localhost:8080     | Go Gateway base URL            |
+----------------------+----------+---------------------------+--------------------------------+

## Agent HTTP URL resolution (Go)

`config.go` resolves the agent service URL as follows:

```go
c.AgentHTTPURL = envStr("HONO_API_URL", envStr("AGENT_HTTP_URL", cfgConst.DefaultAgentHTTPURL))
```

`HONO_API_URL` takes precedence; `AGENT_HTTP_URL` is the fallback; the
default (`http://localhost:3001`) applies when neither is set.

## Docker Compose Env Maps

### Dev (`docker-compose.dev.yml`)

Infra-only file. It defines ONLY `echo-postgres`, `echo-redis`, `echo-migrate`,
and `echo-seed` — there are no backend/agent/frontend services in it.
Application services and their env overrides live in the base
`docker-compose.yml`:

```yaml
# docker-compose.dev.yml (infra-only):
#   echo-postgres: POSTGRES_USER/DB_USER, POSTGRES_PASSWORD/DB_PASSWORD,
#                 POSTGRES_DB/DB_NAME, port ${DB_PORT:-5432}
#   echo-redis:   port 6379
#   echo-migrate: DATABASE_URL, DB_* (command ["./migrate"])
#   echo-seed:    DATABASE_URL, DB_* (command ["./seed"])
```

Note: dev service hostnames are `echo-postgres` / `echo-redis` (not
`postgres` / `redis`).

### Base (`docker-compose.yml`)

Defines all app services (echo-agent, echo-backend, echo-frontend) plus
postgres/redis/migrate/seed. Key env overrides:

```yaml
# Backend:
AGENT_HTTP_URL=http://echo-agent:3001
DB_HOST=echo-postgres
DB_PORT=5432
DB_USER=user
DB_PASSWORD=password
DB_NAME=echo_db
REDIS_ADDR=echo-redis:6379
INTERNAL_AUTH_TOKEN=default-internal-token-secret
ENCRYPTION_KEY=${ENCRYPTION_KEY:-change-this-to-a-32-char-key!!!!}
ENABLE_OTEL=false

# Agent:
INTERNAL_AUTH_TOKEN=default-internal-token-secret
SERVICE_JWT_SECRET=change-this-to-a-secure-service-jwt-secret-min32chars
BACKEND_URL=http://echo-backend:8080
STATE_BACKEND=backend
LLM_MODEL_API_URL=http://host.docker.internal:1234/v1   # read by agent /api/models proxy
REDIS_URL=redis://echo-redis:6379                        # session event store (Active)

# Provider API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENCODE_GO_API_KEY,
# LM_STUDIO_BASE_URL, LM_STUDIO_API_KEY, CORS_ORIGIN) were removed from the
# compose maps — the Go backend never reads them; provider credentials are
# per-user, stored encrypted in the database.
```

### Prod (`docker-compose.prod.yml`)

Layers env overrides over the base file. Defaults: `ENABLE_OTEL=false`
and no `OTEL_COLLECTOR_ADDR` (observability services are commented out).

## Agent Runtime Note

The agent **must** be started with `bun` (not `node`) because `.env` loading is
handled by Bun natively. The `start` script is `"start": "bun run dist/index.js"`,
so starting the built output with `node` would fail.

Use `bun dev` for development (auto-reload on changes) or `bun run dist/index.js`
for production.

## Precedence Rules

1. Runtime env vars (highest)
2. .env file
3. Docker Compose environment block
4. Code defaults in config structs / Zod schemas (lowest)

**Critical rules**:
1. `INTERNAL_AUTH_TOKEN` must be identical in Go Backend and Agent
   configurations. Mismatch causes 403 on all Go -> Agent requests.
2. `SERVICE_JWT_SECRET` must be identical in Go Backend and Agent
   configurations. Mismatch causes 401 on all Agent -> Backend internal
   requests. This secret MUST be different from `JWT_SECRET`.
3. `ENCRYPTION_KEY` must be exactly 32 ASCII characters. Keys encrypted
   with a previous key cannot be decrypted after rotation — users must
   re-save their API key in Settings.

## Entry Points & Exports

- **Go config loading**: `backend/internal/config/config.go`
- **Go config struct**: `backend/internal/models/config/config.go`
- **Go defaults**: `backend/internal/constants/config/defaults.go`
- **Agent env schema**: `agent/src/config/env.schema.ts`
- **Agent env constants**: `agent/src/config/env.constants.ts`
- **Agent .env.example**: `agent/.env.example`
- **Docker Compose**: `docker-compose.yml`, `docker-compose.dev.yml`,
  `docker-compose.prod.yml`
- **K8s**: `infra/k8s/backend.yaml`, `infra/k8s/agent.yaml`,
  `infra/k8s/frontend.yaml`

## Source References

+-------------------------------------------+-------+--------------------------------------+
| File                                      | Lines | Role                                 |
+-------------------------------------------+-------+--------------------------------------+
| backend/internal/models/config/config.go  | 3-28  | Config struct (no provider fields)   |
| backend/internal/constants/config/        | 1-20  | Default values                       |
|   defaults.go                             |       |                                      |
| backend/.env.example                      | 1-29  | All backend env vars                 |
| backend/pkg/crypto/crypto.go              | 14-86 | AES-256-GCM encrypt/decrypt (Encrypt |
|                                           |       | at 14, Decrypt at 41, MaskAPIKey 78) |
+-------------------------------------------+-------+--------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
