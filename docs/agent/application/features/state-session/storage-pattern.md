================================================================================
  Storage Pattern - State Persistence Layer
================================================================================
  Module    : Storage Pattern
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

State persistence layer for agent missions using a factory-pattern storage
abstraction. Provides an in-memory implementation with JSON serialization.
External persistence (backend-backed storage) is handled by the
[Adapter Layer](../adapter/adapter-architecture.md) — specifically
`adapter/outbound/backend/memory.adapter.ts`.

---

## File Structure

```
storage/                     ← Agent-local state cache
  constants.ts               # Backend identifiers, TTL defaults
  factory.ts                 # Singleton stateStorage instance
  memory.ts                  # InMemoryStateProvider implementation
  serializer.ts              # AgentState serialization/deserialization

adapter/outbound/backend/    ← External persistence (via adapter layer)
  memory.adapter.ts          # BackendStateProvider — calls Go backend API
```

---

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│  factory.ts                                                               │
│  createStateProvider()                                                    │
│  ENV.STATE_BACKEND === "backend"                                          │
│    → new MemoryAdapter(ENV.BACKEND_URL)   (calls Go backend API)          │
│  else                                                                     │
│    → new InMemoryStateProvider()          (Map<string, string> cache)     │
│  export stateStorage (untyped union of both provider shapes)              │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  MissionController                                                        │
│                                                                           │
│  state = await stateStorage.get(missionId)                                │
│                                                                           │
│  if state:                                                                │
│    update existing state.objective                                        │
│    push new HumanMessage if not duplicate                                 │
│  else:                                                                    │
│    create fresh state                                                     │
│                                                                           │
│  ... harness execution ...                                                │
│                                                                           │
│  stateStorage.set(missionId, state)  // After EACH iteration AND at end   │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Serialization Pipeline                                                   │
│                                                                           │
│  set():                                                                   │
│    serializeAgentState(state)                                             │
│      → JSON-serializable object (messages mapped to plain objects)        │
│    → JSON.stringify(serialized) → cache.set(missionId, jsonString)        │
│                                                                           │
│  get():                                                                   │
│    raw = cache.get(missionId)                                             │
│    if raw: deserializeAgentState(JSON.parse(raw))                         │
│      → reconstruct LangChain: HumanMessage | AIMessage | SysMsg | ToolMsg│
│      → return AgentState                                                  │
│    else: return null                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Serializer Message Reconstruction

```
  deserializeAgentState(serialized)

  for each msg in serialized.messages:

    msg.type === 'human'  → new HumanMessage(...)
    msg.type === 'ai'     → new AIMessage(...)
    msg.type === 'system' → new SystemMessage(...)
    msg.type === 'tool'   → new ToolMessage(...)
    default               → new HumanMessage(...)

  return { ...serialized, messages }
```

---

## Entry Points & Exports

+---------------------------+-----------------------------+------------------------------------------------+
| Export                    | Source                      | Type                                           |
+---------------------------+-----------------------------+------------------------------------------------+
| `stateStorage`            | `factory.ts:17`             | `InMemoryStateProvider \| MemoryAdapter`       |
| `InMemoryStateProvider`   | `memory.ts`                 | Implementation                                 |
| `MemoryAdapter`           | `adapter/outbound/backend/  | Go backend-backed persistence (HTTP)           |
|                           |   memory.adapter.ts`        |                                                |
| `serializeAgentState`     | `serializer.ts`             | State → JSON                                   |
| `deserializeAgentState`   | `serializer.ts`             | JSON → State                                   |
| `STORAGE_CONSTANTS`       | `constants.ts`              | Constants                                      |
+---------------------------+-----------------------------+------------------------------------------------+

> `stateStorage` has no named interface type — it is the untyped union of
> `InMemoryStateProvider` and `MemoryAdapter` chosen by
> `createStateProvider()` in `factory.ts:7-15` (branch on
> `ENV.STATE_BACKEND === "backend"`).

---

## Dependencies

+----------------------------------+--------------------------------------------------------------+
| Dependency                       | Purpose                                                      |
+----------------------------------+--------------------------------------------------------------+
| `shared/types`                   | `AgentState`                                                 |
| `shared/utils/logger`            | Startup log                                                  |
| `@langchain/core/messages`       | `HumanMessage`, `AIMessage`, `SystemMessage`, `ToolMessage`  |
| `storage/serializer`             | Serialization utilities (local cache)                        |
| `storage/serializer`             | Shared serialization utilities                                |
+----------------------------------+--------------------------------------------------------------+

---

## Source References

+----------------------------+----------------------------------------+----------------------------------------------------+
| Ref                        | File                                   | Key Lines                                          |
+----------------------------+----------------------------------------+----------------------------------------------------+
| Singleton creation         | `factory.ts:14-17`                     | Provider chosen per `ENV.STATE_BACKEND`; singleton `stateStorage` |
| Memory backend             | `memory.ts:6-22`                       | `Map<string, string>` with get/set/delete          |
| Serialize                  | `serializer.ts:4-18`                   | Maps each message to `{ type, content, ... }`     |
| Deserialize                | `serializer.ts:20-70`                  | Switch on `msg.type`, reconstructs LangChain class |
| Controller usage           | `mission.controller.ts:76`             | `stateStorage.get(missionId)` on mission start     |
| Harness persistence        | `harness.ts:1066`                  | `stateStorage.set()` after each iteration          |
| Final save                 | `harness.ts:1100`                  | `stateStorage.set()` after loop ends (TTL 600)     |
| Backend persistence        | `adapter/outbound/backend/memory.adapter.ts` | External persistence via Go backend API            |
+----------------------------+----------------------------------------+----------------------------------------------------+

> `STORAGE_CONSTANTS.BACKEND_MEMORY` is dead code (the factory branches on
> `ENV.STATE_BACKEND`, never on the constant) and `DEFAULT_TTL_SECONDS` is
> unused — the harness passes an explicit TTL of 600 seconds to
> `stateStorage.set()`.

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
