================================================================================
  Adapter Architecture — Unified External Connection Layer
================================================================================
  Module    : Adapter Architecture
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
================================================================================

## Description

> [!WARNING]
> **Status: TARGET ARCHITECTURE (Planned / Under Refactoring)**  
> The unified `agent/src/adapter/` architecture described in this document represents the target design. Outbound connection logic is currently still located in the legacy paths: LLMs are in `src/infrastructure/providers/`, transport tools/MCPs in `src/infrastructure/transports/`, and memory providers in `src/core/agent/storage/backend.ts`.

The **Adapter Layer** is the unified boundary between the Agent core and all
external systems. Every outbound connection — LLM providers, Echo backend,
MCP servers, REST APIs — goes through a typed adapter implementing a generic
`Connection` interface. This gives the agent a single way to connect,
disconnect, health-check, and manage lifecycle of any external dependency.

---

## Motivation

Before this layer, external connections were scattered:

| Connection | Old Location | Problem |
|---|---|---|
| LLM providers | `infrastructure/providers/*` | No unified interface |
| Backend (memory) | `core/agent/storage/backend.ts` | Mixed with storage logic |
| MCP servers | `infrastructure/transports/mcp/` | Separate from providers |
| REST tools | `infrastructure/transports/rest/` | Separate from providers |

Result: the agent core had to know about multiple import paths, connection
semantics, and lifecycle patterns. No single place to add health checks,
reconnection logic, or graceful shutdown.

---

## 3-Layer Architecture

```
agent/src/
  ├── api/              ← HTTP entry (Hono routes, controllers, middleware)
  ├── agent/            ← Core logic (harness, strategies, tools, skills, storage)
  └── adapter/          ← ALL external connections (BARU)
        ├── interfaces.ts    ← Generic Connection interface
        ├── factory.ts       ← AdapterFactory: create connections by type
        ├── manager.ts       ← ConnectionManager: lifecycle, reconnect, health
        ├── llm/             ← LLM provider connections
        │   ├── openai.adapter.ts
        │   ├── anthropic.adapter.ts
        │   ├── openrouter.adapter.ts
        │   ├── lm-studio.adapter.ts
        │   └── index.ts
        ├── backend/         ← Echo Go backend connections
        │   ├── session.adapter.ts    ← session CRUD + commit
        │   ├── memory.adapter.ts     ← episodic recall/store
        │   ├── context.adapter.ts    ← context injection (RAG, topics)
        │   ├── mcp-proxy.adapter.ts  ← MCP discovery via backend
        │   └── index.ts
        ├── mcp/             ← MCP client (existing, moved from transports/)
        │   ├── client.ts
        │   ├── schema-converter.ts
        │   └── index.ts
        └── rest/            ← REST tool adapter (existing, moved from transports/)
            ├── adapter.ts
            └── index.ts
```

---

## Core Interface

Every adapter implements the same `Connection` interface:

```typescript
interface Connection<TConfig, TClient> {
  readonly type: string

  connect(config: TConfig): Promise<TClient>
  disconnect(): Promise<void>
  health(): Promise<HealthStatus>
  isConnected(): boolean
  getClient(): TClient | undefined
}

type HealthStatus = 'healthy' | 'degraded' | 'unreachable'
```

Specialised interfaces extend this for each sub-layer:

```typescript
// LLM Provider Adapter
interface LLMProviderAdapter extends Connection<ProviderConfig, LLMProvider> {
  readonly type: 'openai' | 'anthropic' | 'openrouter' | 'lm-studio' | 'opencode-go'
  stream(messages, tools, systemPrompt): AsyncIterable<ProviderEvent>
}

// Backend Service Adapter
interface BackendAdapter extends Connection<BackendConfig, BackendClient> {
  readonly type: 'session' | 'memory' | 'context' | 'mcp-proxy'
}

// MCP Server Adapter
interface MCPAdapter extends Connection<McpServerConfig, MCPClient> {
  readonly type: 'mcp'
  discoverTools(): Promise<ToolDefinition[]>
}

// REST API Adapter
interface RESTAdapter extends Connection<RestToolConfig, RestClient> {
  readonly type: 'rest'
  execute(toolName, args): Promise<Observation>
}
```

---

## Sub-Layer Responsibilities

### LLM Adapters (`adapter/llm/`)

Connect to LLM providers — OpenAI, Anthropic, OpenRouter (OpenAI-compatible),
LM Studio (local), OpenCode-Go. Each adapter wraps provider-specific SDKs
under the unified `LLMProvider` interface.

Moved from: `infrastructure/providers/`

Key difference: all LLM connections are now created and managed through
`AdapterFactory`, not imported directly. Harness requests a provider by
type + config and receives a connected adapter.

### Backend Adapters (`adapter/backend/`)

Connect to the Echo Go backend for session management, memory persistence,
context injection, and MCP proxy discovery.

Moved from:
- `core/agent/storage/backend.ts` (memory) → `adapter/backend/memory.adapter.ts`
- `core/agent/storage/serializer.ts` → `adapter/backend/serializer.ts` (shared)

Each backend adapter maps to a logical API domain:
- `session.adapter.ts` — `POST/GET/DELETE /v1/sessions`, `POST /v1/sessions/:id/prune`
- `memory.adapter.ts` — `POST /api/v1/internal/memory/episodic/{store,recall}`
- `context.adapter.ts` — context injection topics, RAG lookups
- `mcp-proxy.adapter.ts` — MCP server discovery proxied through backend

### MCP Adapters (`adapter/mcp/`)

Connect to MCP servers via SSE or stdio transport. Discovers tools, executes
calls, manages connection lifecycle.

Moved from: `infrastructure/transports/mcp/`

### REST Adapters (`adapter/rest/`)

Wraps REST APIs as executable tools. Supports auth (bearer, basic, header),
env var resolution (`$env.XXX`), URL interpolation.

Moved from: `infrastructure/transports/rest/`

---

## ConnectionManager

Central lifecycle manager for all connections created during a mission:

```
ConnectionManager
├── create(config) → Connection      ← creates via AdapterFactory
├── get(type, name) → Connection     ← retrieve existing connection
├── list() → Connection[]            ← all active connections
├── health() → Map<string, HealthStatus>
├── reconnect(type, name) → Promise<void>
└── disconnectAll() → Promise<void>  ← graceful shutdown
```

Responsibilities:
- Track all connections by (type, name) pair
- Periodic health checks (configurable interval)
- Automatic reconnection on failure (bounded retry)
- Graceful shutdown: disconnect all on mission end
- Prevent duplicate connections (reuse existing)

---

## Dependency Flow

```
api/  ──→  agent/  ──→  adapter/
                         ├── llm/      (LLM providers)
                         ├── backend/  (Echo backend: session, memory, context, RAG)
                         ├── mcp/      (MCP servers)
                         └── rest/     (REST tool APIs)

agent/core/ (harness, strategies)
    │
    ├── uses ToolRegistry (tools/registry.ts)
    │     ├── uses adapter/mcp/    for MCP tool connections
    │     └── uses adapter/rest/   for REST tool connections
    │
    ├── uses LLMProvider interface
    │     └── implemented by adapter/llm/
    │
    └── uses IStateStore interface
          └── implemented by adapter/backend/memory.adapter.ts
```

Agent core never imports directly from `adapter/`. It depends on interfaces
defined in `shared/types/` and receives implementations via dependency
injection (mission controller creates adapters, passes to harness).

---

## Zero Tight Coupling Compliance

| Rule | How Adapter Layer Satisfies It |
|---|---|
| 1. Interface-first | `Connection<TConfig, TClient>` is the single contract. All adapters implement it. Agent depends on interfaces, not adapters. |
| 2. Provider-agnostic | `LLMProvider` interface unchanged. Adapters are the concrete implementations — swappable by config. |
| 3. Bridge contract | Backend adapters call Go APIs via typed JSON contracts. X-Internal-Token auth. |
| 4. Event bus | Adapter layer is orthogonal to Redis Pub/Sub. Events flow separately. |
| 5. No direct imports | Agent core imports interfaces from `shared/types/`, not adapter concrete classes. |

---

## Current Status

| Sub-layer | Status | Notes |
|---|---|---|
| `adapter/llm/` | **Move** (existing code in `infrastructure/providers/` → `adapter/llm/`) | Refactor only — no logic change |
| `adapter/backend/session.adapter.ts` | **New** | Part of Session Management (Priority 2) |
| `adapter/backend/memory.adapter.ts` | **Move** (from `core/agent/storage/backend.ts`) | Consolidate scattered backend calls |
| `adapter/backend/context.adapter.ts` | **New** | Part of Context Resolver (Priority 4) |
| `adapter/rest/` | **Move** (from `infrastructure/transports/rest/`) | Refactor only |
| `adapter/mcp/` | **Move** (from `infrastructure/transports/mcp/`) | Refactor only |
| `adapter/interfaces.ts` | **New** | Core `Connection` interface |
| `adapter/factory.ts` | **New** | `AdapterFactory.create()` |
| `adapter/manager.ts` | **New** | `ConnectionManager` |

---

## Source References

+----------------------------------------------------+------------------------------------------+
| File                                               | Role                                     |
+----------------------------------------------------+------------------------------------------+
| `shared/types/index.ts`                            | `LLMProvider`, `ToolDefinition`           |
|                                                     | interfaces — unchanged                   |
| `infrastructure/providers/factory.ts`              | Existing `ProviderFactory` — to be       |
|                                                     | wrapped by `AdapterFactory`              |
| `infrastructure/providers/openai/index.ts`         | Existing `OpenAIProvider` — to move      |
| `infrastructure/providers/anthropic/index.ts`      | Existing `AnthropicProvider` — to move   |
| `infrastructure/providers/lm-studio/index.ts`      | Existing `LMStudioProvider` — to move    |
| `infrastructure/providers/opencode-go/index.ts`    | Existing `OpenCodeGoProvider` — to move  |
| `infrastructure/transports/mcp/client.ts`          | Existing `MCPClient` — to move           |
| `infrastructure/transports/rest/adapter.ts`        | Existing `RestToolAdapter` — to move     |
| `core/agent/storage/backend.ts`                    | Existing `BackendStateProvider` —        |
|                                                     | to move to backend/memory.adapter.ts     |
| `core/agent/storage/serializer.ts`                 | Existing serializer — shared util        |
+----------------------------------------------------+------------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
