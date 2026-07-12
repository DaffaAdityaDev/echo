================================================================================
  ENVIRONMENT VARIABLE CONTRACT
================================================================================
  Module    : Environment Contract
  Service   : Shared / Contracts
  Version   : 1.0
  Updated   : 2026-07-09
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
SERVICE_JWT_SECRET=replace-this-with-a-different-secret
ENVIRONMENT=development
AGENT_HTTP_URL=http://localhost:3001
ALLOW_ORIGINS=http://localhost:3000
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
ENABLE_OTEL=false
INTERNAL_AUTH_TOKEN=default-internal-token-secret

OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODELS=gpt-4o,gpt-4o-mini

ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODELS=claude-3-5-sonnet-latest,claude-3-haiku

LM_STUDIO_BASE_URL=
LM_STUDIO_API_KEY=lm-studio

OPENCODE_GO_API_KEY=

DEFAULT_MODEL=gpt-4o

PRUNE_THRESHOLD=100000
PRUNE_KEEP_LATEST_TURNS=10
SUMMARIZE_MAX_TOKENS=500
```

### Config Struct (models.go)

```go
type Config struct {
    Port              string
    DatabaseURL       string
    JWTSecret         string
    ServiceJWTSecret  string
    Environment       string
    AgentHTTPURL      string
    AllowOrigins      string
    RedisAddr         string
    RedisPassword     string
    OtelCollectorAddr string
    EnableOtel        bool
    InternalAuthToken string
    OpenAIAPIKey      string
    OpenAIBaseURL     string
    OpenAIModels      []string
    AnthropicAPIKey   string
    AnthropicBaseURL  string
    AnthropicModels   []string
    LMStudioBaseURL   string
    LMStudioAPIKey    string
    OpenCodeGoAPIKey  string
    DefaultModel      string
    PRUNE_THRESHOLD         int
    PRUNE_KEEP_LATEST_TURNS int
    SUMMARIZE_MAX_TOKENS    int
}
```

### Defaults (Go)

```go
DefaultPort            = "8080"
DefaultDatabaseURL     = "postgresql://localhost/echo_db?sslmode=disable"
DefaultJWTSecret       = "your-secret-key"
DefaultServiceJWTSecret = "default-service-jwt-secret"
DefaultEnvironment     = "development"
DefaultAgentHTTPURL    = "http://localhost:3001"
DefaultAllowOrigins = "http://localhost:3000"
DefaultRedisAddr    = "localhost:6379"
DefaultRedisPass    = ""
DefaultOpenAIBaseURL    = "https://api.openai.com/v1"
DefaultAnthropicBaseURL = "https://api.anthropic.com"
DefaultLMStudioBaseURL  = "http://localhost:1234"
DefaultModel            = "gpt-4o"
DefaultPruneThreshold      = 100000
DefaultPruneKeepLatestTurns = 10
DefaultSummarizeMaxTokens  = 500
```

## Agent (Hono/Bun)

### env.example

```env
PORT=3001
GRPC_PORT=50051
CHROMA_URL=http://localhost:8000
STATE_BACKEND=memory
INTERNAL_AUTH_TOKEN=default-internal-token-secret
SERVICE_JWT_SECRET=replace-this-with-a-different-secret
BACKEND_INTERNAL_URL=http://localhost:8080

# LLM_MODEL_API_URL=http://localhost:1234
# MCP_SERVER_URL=http://localhost:3002/sse
ENABLE_MCP=false
ENABLE_REST_TOOLS=false
```

### Env Schema (Zod)

```typescript
PORT:                    z.string().default("3001")
GRPC_PORT:               z.string().default("50051")
CHROMA_URL:              z.string().default("http://localhost:8000")
LLM_MODEL_API_URL:       z.string().default("http://127.0.0.1:1234")
STATE_BACKEND:           z.enum(["memory", "backend"]).default("memory")
NODE_ENV:                z.enum(["development","production","test"]).default("development")
DEBUG_PROMPT:            z.boolean().default(false)
INTERNAL_AUTH_TOKEN:     z.string()              // REQUIRED
SERVICE_JWT_SECRET:      z.string().min(32)      // REQUIRED, min 32 chars
BACKEND_INTERNAL_URL:    z.string().default("http://localhost:8080")
MCP_SERVER_URL:          z.string().optional()   // MCP SSE endpoint
ENABLE_MCP:              z.coerce.boolean().default(false)
ENABLE_REST_TOOLS:       z.coerce.boolean().default(false)
LANGFUSE_PUBLIC_KEY:     z.string()              // REQUIRED
LANGFUSE_SECRET_KEY:     z.string()              // REQUIRED
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
ENABLE_OTEL=false

# Agent env overrides:
REDIS_URL=redis://redis:6379
LLM_MODEL_API_URL=http://host.docker.internal:1234/v1
STATE_BACKEND=backend

# Frontend env:
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### Prod (`docker-compose.prod.yml`)

```yaml
# Same as dev with:
ENABLE_OTEL=true
OTEL_COLLECTOR_ADDR=otel-collector:4317
```

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
| backend/internal/models/models.go         | 32-60 | Config struct definition             |
| backend/internal/constants/config/        | 1-24  | Default values                       |
|   defaults.go                             |       |                                      |
| backend/.env.example                      | 1-34  | All backend env vars                 |
| agent/src/config/env.schema.ts            | 8-31  | Zod validation                       |
| agent/src/config/env.constants.ts         | 1-19  | Defaults and enum values             |
| agent/.env.example                        | 1-11  | Agent env vars                       |
| docker-compose.dev.yml                    | 27-50 | Backend env in dev                   |
| infra/k8s/backend.yaml                    | 29-47 | K8s env map                          |
+-------------------------------------------+-------+--------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
