================================================================================
  ZERO TIGHT COUPLING ARCHITECTURE
================================================================================
  Module    : Zero Tight Coupling
  Service   : Shared / Architecture
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Echo enforces **Zero Tight Coupling** (or "The Swappable Rule") across all
layers. No service depends on a concrete implementation — interfaces,
abstractions, and contract files isolate every system boundary. Swapping
PostgreSQL for MongoDB, GPT-4 for Claude 3, or React Query for SWR requires
zero domain logic changes.

> [!NOTE]
> **Implementation Status Note**: The Hono Agent files structured under `adapter/` in this document represent the planned Target Architecture. Outbound connections are currently still located in `src/infrastructure/providers/`, `src/infrastructure/transports/`, and `src/core/agent/storage/backend.ts`.

## File Structure

+-------------------+--------------------------+-----------------------------------+
| backend/internal/ | agent/src/               | frontend/web/src/                 |
+-------------------+--------------------------+-----------------------------------+
| models/           | shared/types/            | lib/                              |
|   models.go       |   index.ts               |   api-client.ts                   |
| service/          | api/                     | features/                         |
|   auth_service.go  |   routes.ts             |   auth/                           |
|   model_service.go |   middleware/           |     services/                     |
| repository/       |   missions/              |       auth-api.ts                 |
|   user_repository.| infrastructure/          |     hooks/                        |
|   go              |   providers/             |       useAuth.ts                  |
| handler/          |     openai/              |   chat/                           |
|   auth_handler.go  |     anthropic/           |     api/                          |
|   chat_handler.go  |   transports/           |       useChatStream.ts            |
| middleware/       |     mcp/                 |       useFeatures.ts              |
|   auth.go         |     rest/                |                                   |
+-------------------+--------------------------+-----------------------------------+

## Principles

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                          ZERO TIGHT COUPLING — THE 5 RULES                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                │
│  1. INTERFACE-FIRST (Go)                                                                       │
│     ┌────────────────────────────────────────────────────────────────────────────────────┐    │
│     │ No domain logic depends on a concrete library. We depend on interfaces (Repository,│    │
│     │ Service, Orchestrator). Swapping impl requires zero changes to internal/domain.     │    │
│     │                                                                                    │    │
│     │ Example: userRepo := repository.NewUserRepository(infra)                           │    │
│     │          authSvc := service.NewAuthService(cfg, userRepo)                          │    │
│     └────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                                │
│  2. MODEL AGNOSTIC (Agent)                                                                     │
│     ┌────────────────────────────────────────────────────────────────────────────────────┐    │
│     │ AI logic targets BaseMessage abstractions. Swapping GPT-4 for Claude 3 or a local  │    │
│     │ LM Studio model is a config change, not code change. ProviderFactory selects       │    │
│     │ adapter by provider type.                                                          │    │
│     └────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                                │
│  3. BRIDGE CONTRACT (REST + Internal Auth)                                                     │
│     ┌────────────────────────────────────────────────────────────────────────────────────┐    │
│     │ Go <-> Hono communicate via HTTP with typed JSON schemas. As long as the contract  │    │
│     │ (Zod schema / Go struct) is satisfied, either service can be rewritten entirely.   │    │
│     │ X-Internal-Token secures the bridge.                                               │    │
│     └────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                                │
│  4. PUB/SUB EVENT BUS (Redis)                                                                  │
│     ┌────────────────────────────────────────────────────────────────────────────────────┐    │
│     │ Services communicate asynchronously via Redis Pub/Sub. A service emitting an event │    │
│     │ never knows (or cares) who is listening. Used for mission log streaming in SaaS    │    │
│     │ mode.                                                                               │    │
│     └────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                                │
│  5. FRONTEND REPOSITORY PATTERN                                                                │
│     ┌────────────────────────────────────────────────────────────────────────────────────┐    │
│     │ UI components consume data through abstract hooks. The underlying fetcher (React   │    │
│     │ Query, SWR, or Axios) is injected at the provider level. api-client.ts unifies all │    │
│     │ HTTP calls.                                                                         │    │
│     └────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                                │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

## Interface Contracts

### Go: Service Layer Interface

┌────────────────────────────────────────────────────────────────┐
│                      auth_service.go                            │
│                                                                 │
│  type AuthService interface {              (Programming to      │
│    Register(ctx, RegisterReq) (User, err)    interface)         │
│    Login(ctx, LoginReq) (TokenPair, err)                       │
│    ValidateToken(token) (Claims, err)                          │
│  }                                                             │
│                                                                 │
│  type authService struct {              (Concrete impl hidden   │
│    repo UserRepository                   depends on interface) │
│    cfg  *Config                                                │
│  }                                                             │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                      model_service.go                           │
│                                                                 │
│  type ModelService interface {                                  │
│    GetModels(ctx) ([]ModelInfo, error)                         │
│    ResolveModel(id) (*ProviderConfig, err)                     │
│    GetDefault() *ProviderConfig                                 │
│  }                                                             │
└────────────────────────────────────────────────────────────────┘

### Agent: Provider Agnostic

┌──────────────────────────────────────────────────────────────────────────────────┐
│                           LLMProvider Interface                                    │
│                                                                                    │
│  interface LLMProvider {                                                           │
│    modelName?: string                                                              │
│    baseURL?: string                                                                │
│    maxContextTokens?: number                                                       │
│    stream(messages, tools, systemPrompt): AsyncIterable<ProviderEvent>             │
│    cleanupReasoning?(): Promise<void>                                              │
│  }                                                                                 │
│                                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐                 │
│  │    OpenAI        │  │   Anthropic      │  │   LM Studio      │                 │
│  │   Provider       │  │   Provider       │  │   Provider       │                 │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘                 │
│      implements           implements           implements                          │
│      LLMProvider          LLMProvider          LLMProvider                         │
│                                                                                    │
│   ProviderFactory.fromConfig({ type, base_url, api_key, model })                   │
│     -> returns appropriate LLMProvider implementation                              │
│                                                                                    │
│   Note: Provider implementations live under adapter/llm/ as part of the            │
│   unified Adapter Layer. The agent depends only on the LLMProvider interface.     │
└──────────────────────────────────────────────────────────────────────────────────┘

### Agent: Adapter Agnostic

┌──────────────────────────────────────────────────────────────────────────────────┐
│                          Connection Interface (adapter layer)                       │
│                                                                                    │
│  interface Connection<TConfig, TClient> {                                         │
│    readonly type: string                                                           │
│    connect(config: TConfig): Promise<TClient>                                      │
│    disconnect(): Promise<void>                                                     │
│    health(): Promise<HealthStatus>                                                 │
│    isConnected(): boolean                                                          │
│  }                                                                                 │
│                                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐            │
│  │  LLM Adapter │  │ Backend Adap │  │  MCP Adapter │  │  REST Adap │            │
│  │  (adapter/   │  │ (adapter/    │  │  (adapter/   │  │ (adapter/  │            │
│  │   llm/)      │  │  backend/)   │  │   mcp/)      │  │  rest/)    │            │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘            │
│      implements       implements        implements        implements               │
│                                                                                    │
│  AdapterFactory.create(config) -> Connection                                      │
│  ConnectionManager manages lifecycle of all connections                           │
└──────────────────────────────────────────────────────────────────────────────────┘

### Agent: Strategy Agnostic

┌──────────────────────────────────────────────────────────────────────────────────┐
│                          AgentStrategy Interface                                   │
│                                                                                    │
│  interface AgentStrategy {                                                        │
│    name: string                                                                    │
│    buildSystemPrompt(state, tools): string                                         │
│  }                                                                                 │
│                                                                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐                  │
│  │   ReAct    │  │   NLAH     │  │  Standard  │  │ Sequential │                  │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘                  │
│    implements     implements      implements      implements                       │
│                                                                                    │
│  StrategyFactory.create(strategy): AgentStrategy                                  │
│    -> returns appropriate strategy by name                                        │
└──────────────────────────────────────────────────────────────────────────────────┘

### Frontend: Repository Pattern

┌──────────────────────────────────────────────────────────────────────────────────┐
│                           api-client.ts                                            │
│                                                                                    │
│  export const api = {                                                             │
│    get: <T>(url, opts) => request<T>(url, { ...opts, GET })                      │
│    post: <T>(url, body, opts) => request<T>(url, { POST })                       │
│    stream: <T>(url, body, onChunk) => SSE parser                                 │
│  }                                                                                 │
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────┐   │
│  │  Underlying fetch() call — swappable to Axios/SWR without changing any    │   │
│  │  hook file                                                                │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                    │
│  auth-api.ts -> uses api.post()                                                  │
│  useAuth.ts  -> uses authApi, injected via @tanstack/react-query                  │
│  useChatStream.ts -> uses api.stream()                                           │
└──────────────────────────────────────────────────────────────────────────────────┘

## What Swapping Looks Like

### Swap LLM Provider (OpenAI -> Anthropic)

```
backend/.env:
  # Before:
  OPENAI_API_KEY=sk-xxx
  OPENAI_MODELS=gpt-4o

  # After:
  ANTHROPIC_API_KEY=sk-ant-xxx
  ANTHROPIC_MODELS=claude-3-5-sonnet-latest
  DEFAULT_MODEL=claude-3-5-sonnet-latest
```

Zero code changes. `ModelService.ResolveModel()` checks config providers
agnostically.

### Swap State Store (Memory -> Redis)

```
agent/.env:
  STATE_BACKEND=redis          # was "memory"
  REDIS_URL=redis://redis:6379
```

The `IStateStore` interface abstracts both implementations.

### Swap Database (PostgreSQL -> MongoDB)

```
backend/internal/repositories/
  postgres/                    # Current
    user_repository.go         # implements UserRepository
  mongo/                       # Future
    user_repository.go         # implements same UserRepository interface

backend/config:
  DRIVER=mongo                 # config change
```

## Entry Points & Exports

- **Go interfaces**: `service.ModelService`, `service.AuthService`,
  `repository.UserRepository`
- **Agent interfaces**: `LLMProvider`, `AgentStrategy`, `IStateStore`,
  `ITaskQueue`, `ISandboxExecutor`, `ToolDefinition`
- **Frontend abstraction**: `api` client in `lib/api-client.ts`

## Dependencies

- **Interface-only**: No cross-service import. All contracts are defined
  per-service and satisfied by configuration.
- **Bridge token**: `INTERNAL_AUTH_TOKEN` shared env variable authenticates
  Go -> Hono calls.

## Source References

+-------------------------------------------------------+--------------------------------------+
| File                                                  | Role                                 |
+-------------------------------------------------------+--------------------------------------+
| backend/internal/service/model_service.go             | ModelService interface + impl        |
| backend/internal/handler/chat_handler.go              | Injects ModelService, Redis, Config  |
| agent/src/shared/types/index.ts                       | LLMProvider, AgentStrategy,          |
|                                                       |   IStateStore, ToolDefinition        |
| agent/src/infrastructure/providers/openai/index.ts    | OpenAI provider implementation       |
| agent/src/infrastructure/providers/anthropic/index.ts | Anthropic provider implementation    |
| agent/src/core/agent/storage/backend.ts               | Backend memory storage               |
| agent/src/infrastructure/transports/mcp/client.ts     | MCP server connection                |
| agent/src/infrastructure/transports/rest/adapter.ts   | REST API connection                  |
| agent/src/infrastructure/providers/factory.ts         | ProviderFactory.fromConfig()         |
| agent/src/core/agent/storage/factory.ts               | stateStorage singleton               |
| agent/src/core/agent/strategies/factory.ts            | StrategyFactory.create()             |
| agent/src/config/env.schema.ts                        | Env-based runtime configuration      |
| frontend/web/src/lib/api-client.ts                    | Unified HTTP/SSE client              |
+-------------------------------------------------------+--------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
