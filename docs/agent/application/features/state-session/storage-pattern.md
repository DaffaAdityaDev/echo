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
`adapter/backend/memory.adapter.ts`.

---

## File Structure

```
storage/                     ← Agent-local state cache
  types.ts                   # IStateProvider interface
  constants.ts               # Backend identifiers, TTL defaults
  factory.ts                 # Singleton stateStorage instance
  memory.ts                  # InMemoryStateProvider implementation
  serializer.ts              # AgentState serialization/deserialization

adapter/backend/             ← External persistence (via adapter layer)
  memory.adapter.ts          # BackendStateProvider — calls Go backend API
  serializer.ts              # Shared serialization for backend API calls
```

---

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│  factory.ts                                                               │
│  new InMemoryStateProvider() → Map<string, string> cache                  │
│  export stateStorage: IStateProvider                                      │
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
| `stateStorage`            | `factory.ts`                | `IStateProvider` instance                      |
| `IStateProvider`          | `types.ts`                  | Interface (get, set, delete)                   |
| `InMemoryStateProvider`   | `memory.ts`                 | Implementation                                 |
| `serializeAgentState`     | `serializer.ts`             | State → JSON                                   |
| `deserializeAgentState`   | `serializer.ts`             | JSON → State                                   |
| `STORAGE_CONSTANTS`       | `constants.ts`              | Constants                                      |
+---------------------------+-----------------------------+------------------------------------------------+

---

## Dependencies

+----------------------------------+--------------------------------------------------------------+
| Dependency                       | Purpose                                                      |
+----------------------------------+--------------------------------------------------------------+
| `shared/types`                   | `AgentState`                                                 |
| `shared/utils/logger`            | Startup log                                                  |
| `@langchain/core/messages`       | `HumanMessage`, `AIMessage`, `SystemMessage`, `ToolMessage`  |
| `storage/serializer`             | Serialization utilities (local cache)                        |
| `adapter/backend/serializer`     | Serialization for backend API calls                          |
+----------------------------------+--------------------------------------------------------------+

---

## Source References

+----------------------------+----------------------------------------+----------------------------------------------------+
| Ref                        | File                                   | Key Lines                                          |
+----------------------------+----------------------------------------+----------------------------------------------------+
| Singleton creation         | `factory.ts:6-7`                       | `new InMemoryStateProvider()`                      |
| Memory backend             | `memory.ts:6-22`                       | `Map<string, string>` with get/set/delete          |
| Serialize                  | `serializer.ts:4-18`                   | Maps each message to `{ type, content, ... }`     |
| Deserialize                | `serializer.ts:20-70`                  | Switch on `msg.type`, reconstructs LangChain class |
| Interface                  | `types.ts:3-7`                         | `get()`, `set()` with optional TTL, `delete()`     |
| Controller usage           | `mission.controller.ts:62`             | `stateStorage.get(missionId)` on mission start     |
| Harness persistence        | `nlah/harness.ts:528`                  | `stateStorage.set()` after each turn               |
| Final save                 | `nlah/harness.ts:554`                  | `stateStorage.set()` after loop ends               |
| Backend persistence        | `adapter/backend/memory.adapter.ts`    | External persistence via Go backend API            |
+----------------------------+----------------------------------------+----------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
