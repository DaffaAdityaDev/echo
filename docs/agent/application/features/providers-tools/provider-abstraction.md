================================================================================
  Provider Abstraction - Multi-LLM Provider Factory
================================================================================
  Module    : Provider Abstraction Layer
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Multi-LLM provider factory implementing a unified `LLMProvider` interface over
OpenAI, Anthropic, LM Studio, and OpenCode-Go. Includes reasoning interceptors,
Zod-schema conversion, usage cost calculation, and token-aware context window
resolution.

---

## File Structure

```
infrastructure/providers/
  factory.ts                 # Provider factory (fromConfig)
  index.ts                   # Barrel exports
  openai/
    index.ts                 # OpenAI provider via @langchain/openai
  anthropic/
    index.ts                 # Anthropic provider via @langchain/anthropic
  lm-studio/
    index.ts                 # LM Studio provider via @langchain/openai
  opencode-go/
    index.ts                 # Raw OpenAI SDK with manual serialization
  constants/
    index.ts                 # Pricing models, local URL keywords
  utils/
    index.ts                 # calculateUsageCost
    reasoning-interceptor.ts # Reasoning token capture via SSE tee
    zod-schema.ts            # Zod-to-OpenAI schema converter
```

---

## Flow Diagram

```
                      ┌─────────────────────────────────────┐
                      │     ProviderFactory.fromConfig(cfg)  │
                      └────────────────┬────────────────────┘
                                       │
                              config.type === ?
                                       │
          ┌────────────────┬────────────┬────────────┬────────────────┐
          │                │            │            │                │
          ▼                ▼            ▼            ▼                ▼
    ┌──────────┐   ┌────────────┐ ┌──────────┐ ┌────────────┐
    │  OpenAI  │   │ Anthropic  │ │ LM Studio│ │OpenCode-Go │
    │ChatOpenAI│   │ChatAnthrop│ │ChatOpenAI│ │ OpenAI SDK │
    │bindTools │   │bindTools   │ │bindTools │ │manual ser. │
    └────┬─────┘   └─────┬──────┘ └────┬─────┘ └──────┬─────┘
        │               │            │               │
        └───────────────┼────────────┼───────────────┘
                        │            │
                        ▼            ▼
          ┌──────────────────────────────────────────────┐
          │         Shared LLMProvider Interface         │
          │                                              │
          │  stream(messages, tools, systemPrompt)       │
          │    → AsyncIterable<ProviderEvent>             │
          │  cleanupReasoning() → void                   │
          │  modelName, baseURL, maxContextTokens         │
          └──────────────────────┬───────────────────────┘
                                 │
                                 ▼
          ┌──────────────────────────────────────────────┐
          │          ReasoningInterceptor                 │
          │  interceptFetch(url, options)                 │
          │    → tee response stream                     │
          │    → parse SSE for reasoning/thinking         │
          │    → store per-message-id                    │
          └──────────────────────────────────────────────┘
```

### ProviderEvent Stream Contract

```
Stream Phase 1 - Content + Reasoning
  for each chunk:
    yield { content?: string, reasoning?: string, id?: string }
    (real-time display)

Stream Phase 2 - Tool Call (after stream ends)
  if tool_calls present:
    yield { toolCall: { name, args } }

Stream Phase 3 - Usage (after stream ends)
  if usage_metadata present:
    yield { usage: { promptTokens, completionTokens, totalTokens,
                     cachedTokens?, reasoningTokens? } }
```

---

## Provider Comparison

+----------------------+----------------------+-------------------------+------------------------+---------------------------+
| Feature              | OpenAI               | Anthropic               | LM Studio              | OpenCode-Go               |
+----------------------+----------------------+-------------------------+------------------------+---------------------------+
| Backend              | @langchain/openai    | @langchain/anthropic    | @langchain/openai      | Raw openai SDK            |
| Tool binding         | .bindTools()         | .bindTools() + cache    | .bindTools()           | Manual zodV4ToOpenAISchema|
| Message serialization| LangChain native     | System message merging  | LangChain native       | Custom serializeMessages  |
| Context window       | Dynamic per model    | Fixed 200K              | Pattern-based 32K/16K  | Fixed 1M                  |
| Auth                 | apiKey (dummy)       | anthropicApiKey (dummy) | apiKey (lm-studio)     | apiKey (dummy)            |
| Tool call extraction | Accumulated chunk    | Accumulated chunk       | Accumulated chunk      | Accumulated delta/index   |
| Parallel tool calls  | Single (first)       | Single (first)          | Single (first)         | Multi (per index)         |
| Pricing              | GPT-4o / GPT-4o-mini| Claude 3.5 Sonnet       | Free (local)           | Free (local)              |
+----------------------+----------------------+-------------------------+------------------------+---------------------------+

---

## Entry Points & Exports

+--------------------------+------------------------------------------+------------------------------------------+
| Export                   | Source                                   | Type                                     |
+--------------------------+------------------------------------------+------------------------------------------+
| `ProviderFactory`        | `factory.ts`                             | Static factory with `fromConfig()`        |
| `ProviderConnectionConfig` | `factory.ts`                           | Configuration interface                  |
| `OpenAIProvider`         | `openai/index.ts`                        | `LLMProvider`                            |
| `AnthropicProvider`      | `anthropic/index.ts`                     | `LLMProvider`                            |
| `LMStudioProvider`       | `lm-studio/index.ts`                     | `LLMProvider`                            |
| `OpenCodeGoProvider`     | `opencode-go/index.ts`                   | `LLMProvider`                            |
| `ReasoningInterceptor`   | `utils/reasoning-interceptor.ts`         | SSE reasoning capture                    |
| `zodV4ToOpenAISchema`    | `utils/zod-schema.ts`                    | Schema converter                         |
| `calculateUsageCost`     | `utils/index.ts`                         | Cost calculator                          |
| `PRICING_MODELS`         | `constants/index.ts`                     | Rate tables                              |
+--------------------------+------------------------------------------+------------------------------------------+

---

## Dependencies

+-----------------------------------+--------------------------------------------------------------+
| Dependency                        | Purpose                                                      |
+-----------------------------------+--------------------------------------------------------------+
| `@langchain/openai`               | OpenAI + LM Studio LangChain integration                     |
| `@langchain/anthropic`            | Anthropic LangChain integration                              |
| `openai` (SDK)                    | Raw OpenAI client for OpenCode-Go                            |
| `@langchain/core/messages`        | Message types (SystemMessage, AIMessageChunk)                |
| `zod`                             | Schema definitions                                           |
| `shared/types`                    | `LLMProvider`, `ToolDefinition`, `ProviderEvent`             |
| `shared/constants`                | `LLM_CONFIG` (temperature)                                   |
| `utils/langfuse`                  | LangChain callbacks for tracing                              |
+-----------------------------------+--------------------------------------------------------------+

---

## Source References

+-----------------------------+------------------------------------------+-------------------------------------------------------+
| Ref                         | File                                     | Key Lines                                             |
+-----------------------------+------------------------------------------+-------------------------------------------------------+
| Factory dispatch            | `factory.ts:15-27`                        | `fromConfig()` switch on `config.type`                |
| LLMProvider interface       | `shared/types/index.ts:162-172`          | `stream()` + `cleanupReasoning()`                     |
| ProviderEvent               | `shared/types/index.ts:139-156`          | Content, reasoning, toolCall, usage variants          |
| ReasoningInterceptor        | `utils/reasoning-interceptor.ts:12-25`   | `interceptFetch()` tees SSE stream                    |
| Reasoning extraction        | `utils/reasoning-interceptor.ts:30-88`   | Parses delta.reasoning_content, thinking_delta        |
| Zod schema conversion       | `utils/zod-schema.ts:4-91`              | Handles Object, String, Number, Boolean, Enum, Array  |
| Cost calculation            | `utils/index.ts:5-42`                   | Pattern matching to rate tables                       |
| Pricing constants           | `constants/index.ts:10-34`              | `PRICING_MODELS` rate tables                          |
| OpenAI context window       | `openai/index.ts:31-63`                 | `resolveContextWindow()` for GPT, DeepSeek, etc.      |
| Anthropic max               | `anthropic/index.ts:28`                 | Fixed 200K context                                    |
| LM Studio context           | `lm-studio/index.ts:37-44`              | Pattern-based fallback                                |
+-----------------------------+------------------------------------------+-------------------------------------------------------+

=---

## Transport Layer Abstraction → Adapter Layer

Providers abstract LLM communication (the **reasoning engine**). A parallel
**Transport layer** (now part of the unified **Adapter Layer**) abstracts
tool execution (the **action engine**). They are independent concerns that
compose at the harness level and are managed by `ConnectionManager`.

```
Architecture Separation (with Adapter Layer):

┌──────────────────────────────────────────────────────────────────────────┐
│                  Agent System Architecture (3-Layer)                       │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │  api/  (HTTP entry — routes, controllers, middleware)              │   │
│  └────────────────────────────────┬───────────────────────────────────┘   │
│                                   │ injects adapters                      │
│                                   ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │  agent/  (Core logic — harness, strategies, tools, skills)           │   │
│  │                                                                    │   │
│  │  depends on interfaces (LLMProvider, ToolDefinition, IStateStore)  │   │
│  └────────────────────────────────┬───────────────────────────────────┘   │
│                                   │ uses via interfaces                   │
│                                   ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │  adapter/  (Unified External Connection Layer)                     │   │
│  │                                                                    │   │
│  │  ┌─────────────────────────────────┐  ┌──────────────────────────┐ │   │
│  │  │  llm/  (LLM Providers)          │  │  backend/  (Echo Backend) │ │   │
│  │  │                                 │  │                          │ │   │
│  │  │  OpenAI ──→ ChatOpenAI          │  │  session.adapter.ts      │ │   │
│  │  │  Anthropic ──→ ChatAnthropic    │  │  memory.adapter.ts       │ │   │
│  │  │  LM Studio ──→ ChatOpenAI(local)│  │  context.adapter.ts      │ │   │
│  │  │  OpenCode-Go ──→ OpenAI SDK     │  │  mcp-proxy.adapter.ts    │ │   │
│  │  │  OpenRouter ──→ OpenAI compat   │  │                          │ │   │
│  │  │                                 │  │                          │ │   │
│  │  │  Output: ProviderEvent stream   │  │  Output: typed API resp. │ │   │
│  │  └─────────────────────────────────┘  └──────────────────────────┘ │   │
│  │                                                                    │   │
│  │  ┌─────────────────────────────────┐  ┌──────────────────────────┐ │   │
│  │  │  mcp/  (MCP Servers)            │  │  rest/  (REST APIs)      │ │   │
│  │  │                                 │  │                          │ │   │
│  │  │  Client via @modelcontextprotocol│  │  HTTP fetch adapter     │ │   │
│  │  │  Tool discovery + execution     │  │  Auth: bearer/basic/env  │ │   │
│  │  │                                 │  │                          │ │   │
│  │  │  Output: ToolDefinition + Obs   │  │  Output: Observation     │ │   │
│  │  └─────────────────────────────────┘  └──────────────────────────┘ │   │
│  │                                                                    │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │  ConnectionManager — lifecycle, health check, reconnect      │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  Harness: adapter/llm/provider.stream() → detect toolCall           │ │
│  │         → adapter/mcp/rest.execute()                                │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### Provider vs Transport Responsibilities (both under Adapter Layer)

+---------------------+--------------------------------------------------+--------------------------------------------------+
| Aspect              | Provider (adapter/llm/)                          | Transport (adapter/mcp/, adapter/rest/)          |
+---------------------+--------------------------------------------------+--------------------------------------------------+
| Role                | Reasoning engine                                  | Action engine                                    |
| Interface           | `LLMProvider.stream()`                           | `ToolDefinition.execute()`                        |
| Input               | Messages + tools + system prompt                  | Tool name + args + credential context             |
| Output              | ProviderEvent (content, toolCall, usage)          | Observation (status, summary, data, error)        |
| Implementations     | OpenAI, Anthropic, LM Studio, OpenCode-Go,       | MCP Client, REST Adapter, Built-in tools         |
|                     | OpenRouter                                        |                                                  |
| Configuration       | provider_config (type, base_url, api_key, model) | transport_config (type, url, headers, credentials)|
| Credential handling | LLM API keys passed via provider_config           | Never sees raw values (Credential Manager)         |
+---------------------+--------------------------------------------------+--------------------------------------------------+

This separation allows the same provider to use any transport, and the same
transport to work with any provider. The harness bridges them.

---

## Migration: Infrastructure → Adapter Layer

The current `infrastructure/providers/` directory will relocate to
`adapter/llm/`. The `infrastructure/transports/` directory will relocate to
`adapter/mcp/` and `adapter/rest/`. During migration, both paths will be
supported through barrel re-exports to avoid breaking imports.

See [`adapter-architecture.md`](../adapter/adapter-architecture.md) for the
full adapter layer design.

===============================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
