================================================================================
  ENVIRONMENT VARIABLE CONTRACT
================================================================================
  Module    : Environment Contract
  Service   : Shared / Contracts
   Version   : 1.1
   Updated   : 2026-07-26
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
| backend/internal/models/models.go     | Config struct definition                    |
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
| DB_               | Go Backend      | Database connection parameters       |
| JWT_              | Go Backend      | User JWT signing configuration       |
| SERVICE_JWT_      | Go + Agent      | Service-to-service JWT secret        |
| REDIS_ / REDIS    | Go + Agent      | Redis connection                     |
| OTEL_             | Go + Agent +    | OpenTelemetry collector address      |
|                   |   Infra         |                                      |
| LANGFUSE_         | Agent           | Langfuse observability credentials   |
| AGENT_            | Go Backend      | Agent service URL                    |
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
AGENT_HTTP_URL=http://localhost:3001
ALLOW_ORIGINS=http://localhost:3000
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
ENABLE_OTEL=false
INTERNAL_AUTH_TOKEN=default-internal-token-secret

# Default model when user doesn't specify
DEFAULT_MODEL=opencode-go/deepseek-v4-flash

# Encryption key for user API key storage (must be exactly 32 characters for AES-256)
ENCRYPTION_KEY=change-this-to-a-32-char-key!!!!
```

Provider API keys and base URLs removed from server-level config.
They are now per-user settings stored encrypted in the database (UserPreferences).

### Config Struct (models.go)

```go
type Config struct {
    Port                string
    DatabaseURL         string
    JWTSecret           string
    ServiceJWTSecret    string
    Environment         string
    AgentHTTPURL        string
    AllowOrigins        string
    RedisAddr           string
    RedisPassword       string
    OtelCollectorAddr   string
    EnableOtel          bool
    InternalAuthToken   string
    DefaultModel        string
    EncryptionKey       string
    EvaluatorEndpoint   string
    EvaluatorAPIKey     string
    EvaluatorModel      string
    PRUNE_THRESHOLD         int
    PRUNE_KEEP_LATEST_TURNS int
    SUMMARIZE_MAX_TOKENS    int
}
```

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

Note: PRUNE_THRESHOLD (100000), PRUNE_KEEP_LATEST_TURNS (10), SUMMARIZE_MAX_TOKENS (500),
and ENCRYPTION_KEY have inline defaults in config.go — no corresponding named constants.

Provider defaults removed (DefaultOpenAIBaseURL, DefaultAnthropicBaseURL, DefaultLMStudioBaseURL).
Provider base URLs are now user-level defaults in service/aimodel/service.go / service/settings/service.go.

## Agent (Hono/Bun)

### env.example

```env
PORT=3001
GRPC_PORT=50051
CHROMA_URL=http://localhost:8000
STATE_BACKEND=memory
INTERNAL_AUTH_TOKEN=default-internal-token-secret
SERVICE_JWT_SECRET=replace-this-with-a-different-secret
BACKEND_URL=http://localhost:8080
NODE_ENV=development

FIRECRAWL_URL=http://localhost:3005
FIRECRAWL_API_KEY=

LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_BASE_URL=http://localhost:3000

# LLM_MODEL_API_URL=http://localhost:1234  (unused — model listing is per-user on Go backend)
# MCP_SERVER_URL=http://localhost:3002/sse
ENABLE_MCP=false
ENABLE_REST_TOOLS=false
```

### Env Schema (Zod)

```typescript
PORT:                    z.string().default("3001")
GRPC_PORT:               z.string().default("50051")
CHROMA_URL:              z.string().default("http://localhost:8000")
LLM_MODEL_API_URL:       z.string().default("http://127.0.0.1:1234")  // Unused — kept for backward compat
STATE_BACKEND:           z.enum(["memory", "backend"]).default("memory")
NODE_ENV:                z.enum(["development","production","test"]).default("development")
DEBUG_PROMPT:            z.coerce.boolean().default(false)
INTERNAL_AUTH_TOKEN:     z.string()              // REQUIRED (no default)
SERVICE_JWT_SECRET:      z.string().min(32).default("change-this-to...")
BACKEND_URL:             z.string().default("http://localhost:8080")
MCP_SERVER_URL:          z.string().optional()   // MCP SSE endpoint
ENABLE_MCP:              z.coerce.boolean().default(false)
ENABLE_REST_TOOLS:       z.coerce.boolean().default(false)
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

## Docker Compose Env Maps

### Dev (`docker-compose.dev.yml`)

```yaml
# Backend env overrides:
AGENT_HTTP_URL=http://agent:3001
DB_HOST=postgres
DB_PORT=5432
DB_USER=user
DB_PASSWORD=password
DB_NAME=echo_db
REDIS_ADDR=redis:6379
INTERNAL_AUTH_TOKEN=default-internal-token-secret
ENCRYPTION_KEY=change-this-to-a-32-char-key!!!!
ENABLE_OTEL=false

# Agent env overrides:
REDIS_URL=redis://redis:6379
STATE_BACKEND=backend

# Frontend env:
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Note: LLM_MODEL_API_URL removed from agent overrides. Model listing is now
per-user via Go backend's GET /api/v1/models (JWT auth required).

### Prod (`docker-compose.prod.yml`)

```yaml
# Same as dev with:
ENABLE_OTEL=true
OTEL_COLLECTOR_ADDR=otel-collector:4317
```

## Agent Runtime Note

The agent **must** be started with `bun` (not `node`) because `.env` loading is
handled by Bun natively. The `start` script in `package.json` uses `node`, which
will fail with missing env errors since `dotenv.config()` is never called in code.

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
- **Go config struct**: `backend/internal/models/models.go:32-54`
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
| backend/internal/models/models.go         | 32-53       | Config struct (no provider fields) |
| backend/internal/constants/config/        | 1-20        | Default values                     |
|   defaults.go                             |             |                                    |
| backend/.env.example                      | 1-18        | All backend env vars               |
| backend/pkg/crypto/crypto.go              | 1-65        | AES-256-GCM encrypt/decrypt        |
+-------------------------------------------+-------+--------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
