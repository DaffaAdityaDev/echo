===============================================================================
  Providers & Tools Layer
===============================================================================
  Module    : Providers & Tools
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
===============================================================================

## Overview

LLM provider interface definitions and tool registry patterns. Concrete
implementations of providers (OpenAI, Anthropic, etc.), MCP client, and REST
adapter are moving to the unified [adapter layer](../adapter/adapter-architecture.md).

## Documents

| File                     | Description                                      |
|--------------------------|--------------------------------------------------|
| provider-abstraction.md  | LLMProvider interface definition (implementations |
|                          | moving to adapter/llm/)                           |
| tool-registry-pattern.md | Lazy-loaded tool registry with autodiscovery     |
| mcp-client-pattern.md    | MCP client pattern (moving to adapter/mcp/)      |
| rest-adapter-pattern.md  | REST API adapter pattern (moving to adapter/rest/)|
| credential-manager.md    | Secure env reference system ($env.<NAME>),       |
|                          | agent never sees raw credential values           |

## Relationship to Adapter Layer

```
┌────────────────────────────────────────────────────────────────────┐
│  providers-tools/  (interfaces + patterns)                        │
│                                                                    │
│  ├── provider-abstraction.md    →  LLMProvider interface           │
│  ├── mcp-client-pattern.md      →  MCP connection pattern         │
│  ├── rest-adapter-pattern.md    →  REST connection pattern         │
│  └── credential-manager.md      →  Credential resolution pattern  │
└────────────────────────────┬───────────────────────────────────────┘
                             │  implemented by
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│  adapter/  (concrete implementations)                              │
│                                                                    │
│  ├── llm/openai.adapter.ts          ← implements LLMProvider       │
│  ├── llm/anthropic.adapter.ts       ← implements LLMProvider       │
│  ├── mcp/client.ts                  ← MCP connection               │
│  ├── rest/adapter.ts                ← REST connection              │
│  └── backend/memory.adapter.ts      ← Backend storage              │
└────────────────────────────────────────────────────────────────────┘
```

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
