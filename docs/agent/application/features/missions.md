================================================================================
  Missions - Agent Execution Mission Management
================================================================================
  Module    : Mission Management
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Mission management endpoints for creating and running agent execution missions.
Supports SSE streaming transport, multi-strategy orchestration, and Zod schema
validation.

---

## File Structure

```
missions/
  mission.routes.ts      # Route definitions
  mission.controller.ts  # Request handling and orchestration
  mission.schema.ts      # Zod validation schemas
  mission.constants.ts   # Strategy aliases, defaults, log messages
  stream.transport.ts    # SSE packet transport layer
```

---

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    HTTP POST /generate-mission                            │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          mission.routes.ts                                │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       mission.controller.ts                               │
│                       createMission(c: Context)                           │
│                                                                           │
│  Creates LLM provider via ProviderFactory.fromConfig():                    │
│    → infrastructure/providers/  (based on provider_config)                │
│  Resolves tools via toolRegistry.resolveTools(features)                   │
│  Uses stateStorage for state persistence                                   │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                   ┌─────────────────┴─────────────────┐
                   │                                   │
                   ▼                                   ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────────┐
│  Parse body + query params       │  │  MissionPayload Construction         │
│                                  │  │                                      │
│  createMissionSchema.safeParse() │  │  ProviderFactory.fromConfig(config)  │
│                                  │  │  StrategyFactory.create(strategy)    │
│  Zod preprocessing:              │  │  stateStorage.get(missionId)         │
│  - strategy alias normalization  │  │  toolRegistry.resolveTools(features) │
│  - prompt from "message" field  │  │  If features explicitly set:          │
│  - snake_case ID fallbacks      │  │    resolveTools(features)            │
│                                  │  │    skills do NOT add tools          │
│                                  │  │  If features undefined + skills:     │
│                                  │  │    resolveTools(skills.preferredTools)│
│                                  │  │  If neither: harness → ToolRetriever │
│                                  │  │  StandardContextAnchor.build()       │
└──────────────┬───────────────────┘  └──────────────────┬───────────────────┘
               │                                         │
               └─────────────────┬───────────────────────┘
                                 │
                                 ▼
          ┌─────────────────────────────────────────────────────┐
          │  streamSSE(c, async (streamInstance) => { ... })    │
          │  HttpStreamTransport(streamInstance)                │
          │  Heartbeat interval (15s ping)                      │
          │  CancellationManager.register(missionId)            │
          └──────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
          ┌─────────────────────────────────────────────────────┐
           │  NlahHarness({ strategy, tools })              │
           │  harness.runMission(state, onPacket)                │
           │                                                     │
           │  Harness uses provider and tools via interfaces:    │
           │    → infrastructure/providers/ (LLMProvider)        │
           │    → toolRegistry + retriever (ToolDefinition)     │
           │                                                     │
           │  for each packet:                                   │
           │    HttpStreamTransport.send(packet)                 │
           │    → streamInstance.writeSSE({ data: JSON })        │
           │    → seq++, timestamp                               │
          └──────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
          ┌─────────────────────────────────────────────────────┐
           │  Cleanup: stateStorage cleanup                      │
           │  clearInterval                                      │
           │  cancellationManager.unregister(missionId)          │
          └─────────────────────────────────────────────────────┘
```

---

## Entry Points & Exports

+-------------------------+---------------------------+--------------------------------------+
| Export                  | Source                    | Type                                 |
+-------------------------+---------------------------+--------------------------------------+
| `missionRouter`          | `mission.routes.ts`        | `Hono` router                        |
| `missionController`      | `mission.controller.ts`    | `MissionController` instance         |
| `createMissionSchema`    | `mission.schema.ts`        | `ZodSchema`                          |
| `HttpStreamTransport`    | `stream.transport.ts`      | `StreamTransport` implementation     |
| `MISSION_STRATEGIES`     | `mission.constants.ts`     | Strategy enum array                  |
| `DEFAULT_MISSION_VALUES` | `mission.constants.ts`     | Default tenant/user/strategy         |
+-------------------------+---------------------------+--------------------------------------+

---

## Dependencies

+------------------------+--------------------------------------------------------------+
| Dependency             | Purpose                                                      |
+------------------------+--------------------------------------------------------------+
| `hono`                 | HTTP framework, `streamSSE`                                  |
| `zod`                  | Schema validation                                            |
| `ProviderFactory`      | LLM provider creation (infrastructure/providers/factory.ts)  |
| `StrategyFactory`      | Strategy selection (core/agent/strategies/factory.ts)        |
| `NlahHarness`          | Execution harness (core/agent/harness/nlah/harness.ts)       |
| `toolRegistry`         | Conditional tool resolution — only when features explicitly set |
| `stateStorage`         | State persistence (core/agent/storage/factory.ts)            |
| `StandardContextAnchor`| Context anchor builder (core/agent/anchors/standard.ts)      |
| `cancellationManager`  | Abort signal management (core/agent/harness/cancel_manager.ts)|
| `mapHistoryToMessages` | LangChain message reconstruction                             |
| `@langchain/core/messages` | Message types (`HumanMessage`)                           |
+------------------------+--------------------------------------------------------------+

---

## Source References

+--------------------------+----------------------------------------+------------------------------------------+
| Ref                      | File                                   | Key Lines                                |
+--------------------------+----------------------------------------+------------------------------------------+
| Route registration       | `mission.routes.ts`                    | `router.post("/generate-mission", ...)`   |
| Controller               | `mission.controller.ts`                | `createMission()` orchestrates flow      |
| Schema preprocessing     | `mission.schema.ts:9-39`               | Normalizes strategy aliases, IDs         |
| Schema validation        | `mission.schema.ts:40-61`              | Zod object with prompt, strategy, etc.   |
| Strategy constants       | `mission.constants.ts`                 | `STRATEGY_MAPPING` alias map             |
| SSE transport            | `stream.transport.ts`                  | `HttpStreamTransport.send()` enrichment  |
| Heartbeat                | `mission.controller.ts:88-90`          | 15-second ping interval                  |
| Cancellation             | `mission.controller.ts:92,113-114`     | Registers `AbortSignal` on start         |
| State reconstruction     | `mission.controller.ts:62-82`          | Loads prior state or creates fresh       |
| Provider config          | `mission.schema.ts:48-53`              | `provider_config` with type, URL, key    |
| Provider init            | `infrastructure/providers/factory.ts`  | `ProviderFactory.fromConfig()`          |
+--------------------------+----------------------------------------+------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
