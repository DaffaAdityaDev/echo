================================================================================
  Features — Feature Documentation
================================================================================
  Module    : Features
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
================================================================================

## Overview

Feature documentation for the agent service. Each subdirectory covers a
distinct domain: API endpoints, external connections, execution engine,
providers and tools, session management, and agent behavior.

---

## Directory Structure

```
features/
├── (root)              ← API endpoint docs (missions, models, features)
├── adapter/            ← External connection layer (LLM, backend, MCP, REST)
├── execution/          ← Agent execution loop (harness, strategy, circuit breaker)
├── providers-tools/    ← LLM provider interfaces & tool registry
├── state-session/      ← State persistence & session management
└── behavior/           ← Skills & shared utilities
```

---

## API Endpoints

| Document                       | Description                                      |
|--------------------------------|--------------------------------------------------|
| missions.md                    | Mission creation and execution via SSE streaming |
| models.md                      | LLM model listing proxied to provider API        |
| features.md                    | Dynamic tool/feature catalog discovery           |

---

## Feature Modules

### adapter/

| Document                  | Description                                      |
|---------------------------|--------------------------------------------------|
| adapter-architecture.md   | Unified external connection layer — Connection    |
|                           | interface, sub-layers (llm, backend, mcp, rest),  |
|                           | ConnectionManager, dependency flow               |

### execution/

| Document                  | Description                                      |
|---------------------------|--------------------------------------------------|
| harness-pattern.md        | Core agent execution loop with NLAH harness      |
| strategy-pattern.md       | Agent execution mode factory (Standard, ReAct,   |
|                           | NLAH)                                            |
| anchor-pattern.md         | Context anchor system for LLM grounding          |
| circuit-breaker-          | Per-tool circuit breaker, bounded retry,         |
| pattern.md                | strategy degradation, observation compression    |
| context-resolver-         | Intent classifier, topic registry, template     |
| pattern.md                | injection, hybrid retrieval for >500 topics      |

### providers-tools/

| Document                  | Description                                      |
|---------------------------|--------------------------------------------------|
| provider-abstraction.md   | LLMProvider interface definition (implementations |
|                           | moving to adapter/llm/)                           |
| tool-registry-pattern.md  | Lazy-loaded tool registry with autodiscovery     |
| mcp-client-pattern.md     | MCP client pattern (moving to adapter/mcp/)      |
| rest-adapter-pattern.md   | REST API adapter (moving to adapter/rest/)       |
| credential-manager.md     | Secure env reference system ($env.<NAME>)         |

### state-session/

| Document                  | Description                                      |
|---------------------------|--------------------------------------------------|
| storage-pattern.md        | State persistence with in-memory/backend storage  |
| session-config.md         | All configurable parameters per session,         |
|                           | Zod schema, parameter table, example JSON        |
| session-management.md     | Go Backend as Session Authority, session CRUD,   |
|                           | turn lifecycle, commit policy, delegated pruning |
| agent-status-protocol.md  | Live agent state visibility — stalled, looping,  |
|                           | degraded detection with frontend components      |

### behavior/

| Document                  | Description                                      |
|---------------------------|--------------------------------------------------|
| skills-system.md          | Behavioral pattern system — prompt templates     |
|                           | + tool preferences per skill                     |
| shared-utils.md           | Cross-cutting types, constants, utilities,       |
|                           | middleware                                        |

---

## Dependency Flow Between Feature Modules

```
adapter/          (no dependencies — external connection implementations)
providers-tools/  (no dependencies — interfaces only)
state-session/    (no dependencies)
       │
       ▼
execution/        (depends on interfaces from providers-tools + state-session)
       │
       ▼
behavior/         (depends on execution/ interfaces)
```

Note: `adapter/` contains concrete implementations that satisfy interfaces
defined in `shared/types/`. The `agent/` core layer depends on those
interfaces, not on adapter implementations. Dependency injection at the
`api/` layer connects them.

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
