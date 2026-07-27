================================================================================
  Adapter Layer — External Connection Layer
================================================================================
  Module    : Adapter Layer
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
================================================================================

## Overview

Unified external connection layer. Every outbound connection — LLM providers,
Echo backend, MCP servers, REST APIs — goes through a typed adapter
implementing the generic `Connection` interface.

## Documents

| File                     | Description                                      |
|--------------------------|--------------------------------------------------|
| adapter-architecture.md  | Full adapter architecture — 3-layer design,       |
|                          | Connection interface, sub-layers,                 |
|                          | ConnectionManager, dependency flow               |

## Sub-Layer Map

```
adapter/
├── interfaces.ts          ← Generic Connection interface
├── factory.ts             ← AdapterFactory.create()
├── manager.ts             ← ConnectionManager lifecycle
├── llm/                   ← LLM providers
│     (OpenAI, Anthropic, OpenRouter, LM Studio, OpenCode-Go)
├── backend/               ← Echo Go backend
│     (session, memory, context, mcp-proxy)
├── mcp/                   ← MCP servers
│     (SSE/stdio transport, tool discovery)
└── rest/                  ← REST API tools
      (HTTP fetch, auth, env var resolution)
```

## Related

- [`provider-abstraction.md`](../providers-tools/provider-abstraction.md)
  — Existing LLM provider interface (will be moved to `adapter/llm/`)
- [`mcp-client-pattern.md`](../providers-tools/mcp-client-pattern.md)
  — Existing MCP client pattern (will be moved to `adapter/mcp/`)
- [`rest-adapter-pattern.md`](../providers-tools/rest-adapter-pattern.md)
  — Existing REST adapter pattern (will be moved to `adapter/rest/`)
- [`credential-manager.md`](../providers-tools/credential-manager.md)
  — Credential resolution shared across adapter types

## Zero Tight Coupling

The adapter layer satisfies Zero Tight Coupling: the agent core depends only
on interfaces from `shared/types/`, not on adapter implementations.
`ConnectionManager` creates adapters at the API layer (`mission.controller.ts`)
and injects them into the harness.

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
