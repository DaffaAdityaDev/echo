================================================================================
  Tool Registry - Lazy-Loaded Tool Registry
================================================================================
  Module    : Tool Registry Pattern
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Lazy-loaded tool registry combining static imports and filesystem auto-discovery.
Provides explicit tool-binding isolation for sub-agent execution and a feature
catalog exposed via the API.

---

## File Structure

```
tools/
  index.ts          # Barrel re-export
  registry.ts       # ToolRegistry class, LAZY_TOOLS, ACTIVE_FEATURES
  definitions/
    web-search/     # DuckDuckGo HTML search (no API key needed)
    planning/       # Task board (write_todos) → STATE.md
    delegation/     # Sub-agent spawning via nested AgentHarness
```

---

## Flow Diagram

```
                    ┌─────────────────────────────────────┐
                    │      ToolRegistry (singleton)        │
                    └────────────────┬────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
┌─────────────────────────┐  ┌──────────────┐  ┌──────────────────────┐
│      autoload()          │  │resolveTools()│  │ getTool() / getAll() │
│                          │  │  (features?) │  │                      │
│  readdir(definitions/)   │  │              │  │ Map<string, ToolDef> │
│  for each .ts/.js:       │  │ if features: │  │ O(1) lookup          │
│    import()              │  │ LAZY_TOOLS   │  └──────────────────────┘
│    validate tool.name    │  │ [featureId]  │
│    && tool.schema        │  │ → dynamic    │
│    this.tools.set(name)  │  │   import     │
└─────────────────────────┘  │              │
                              │ if no feats: │
                              │ getAllTools()│
                              │ ─── merges 3 │
                              │   sources:   │
                              │ ① tools Map  │
                              │ ② mcpClients │
                              │    .getTools()│
                              │ ③ restTools[]│
                              └──────────────┘
                                     │
                                     ▼
                    ┌───────────────────────────────────────┐
                    │   Harness / Sub-agent usage           │
                    │                                       │
                    │  explicitTools ? filteredPhysical     │
                    │  : toolRetriever.getRelevantTools()   │
                    │                                       │
                    │  toolMap = new Map(name → tool)       │
                    └───────────────────────────────────────┘
```

### Tool Definition Contract

```typescript
interface ToolDefinition {
  name: string;                // Unique identifier
  description: string;         // Human-readable description
  schema: z.ZodObject<any>;    // Zod input schema
  keywords?: string[];         // Retrieval keywords
  execute: (input: any, config?: any) => Promise<Observation>;
}
```

---

## MCP Server Integration

The registry manages MCP (Model Context Protocol) server lifecycles via `this.mcpClients: Map<string, MCPClient>`:

```typescript
async connectMCPServer(config: McpServerConfig): Promise<MCPClient>
```

- Registers config.credentials with `this.credentialManager.registerToolCredentials()`
- Instantiates `new MCPClient(config)`, calls `client.connect()` + `client.discoverTools()`
- Stores client in `this.mcpClients` map keyed by `config.name`
- Idempotent: returns existing client if `config.name` already connected

```typescript
async disconnectMCPServer(name: string): Promise<void>
```

- Calls `client.disconnect()`, removes from `this.mcpClients`
- No-op (warn-only) if server name not found

```typescript
getMCPServer(name: string): MCPClient | undefined
```

Accessor for direct MCPClient operations (e.g. custom tool queries).

### Lifecycle

```
connectMCPServer()
    │
    ▼
MCPClient.connect() ──── transport handshake
    │
    ▼
MCPClient.discoverTools() ──── tool list from server → stored internally
    │
    ▼
this.mcpClients.set(name, client) ──── available via getAllTools()

disconnectMCPServer()
    │
    ▼
client.disconnect() → this.mcpClients.delete(name)
```

---

## REST Tool Integration

Adds externally-defined HTTP API tools without a full MCP server:

```typescript
addRestTool(config: RestToolConfig): void
```

- Calls `RestToolAdapter.createTool(config)` to build a `ToolDefinition` wrapping HTTP calls
- Pushes result into `this.restTools: ToolDefinition[]`
- Registers `config.headers` and `config.params` with `this.credentialManager.registerToolCredentials()`
- Registered tools appear in `getAllTools()` alongside MCP and lazy-loaded tools

REST tools do not require a persistent connection — they are stateless adapters that translate tool invocation into HTTP requests.

---

## Tool Catalog

+-----------------------+--------------------------+--------+------------------+------------------------------------------------+
| Tool ID               | Name                     | Tier   | UI Render        | Description                                    |
+-----------------------+--------------------------+--------+------------------+------------------------------------------------+
| `delegate_task`       | Sub-Agent Delegation     | pro    | hierarchy_tree   | Nested AgentHarness sub-agents                 |
| `web_search`          | Web Search               | free   | card_list        | DuckDuckGo HTML search                         |
| `write_todos`         | Task Planning & Board    | free   | kanban_board     | STATE.md task persistence                      |
+-----------------------+--------------------------+--------+------------------+------------------------------------------------+

---

## Tool Execution Flow

```
    ┌────────────────────────────────────────────────────────────────────┐
    │                        Harness iteration                           │
    └────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
    ┌────────────────────────────────────────────────────────────────────┐
    │               provider.stream() emits toolCall event               │
    └────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
    ┌────────────────────────────────────────────────────────────────────┐
    │                   toolMap.get(toolName)  O(1) lookup                │
    └────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
    ┌────────────────────────────────────────────────────────────────────┐
    │  tool.execute(args, { parentMessages, onPacket, provider, tools })  │
    │                                                                    │
  │  +-- web_search:       fetch DDG → parse → Observation            │
  │  +-- write_todos:      mkdir + writeFile(STATE.md)                │
  │  +-- delegate_task:    new AgentHarness() → runMission → collect  │
    │                                                                    │
    │  return Observation { status, summary, data?, error? }             │
    └────────────────────────────────────────────────────────────────────┘
```

---

## Sub-Agent Isolation

```
    delegate_task execution:

    ┌────────────────────────────────────────────────────────────────────┐
    │  new AgentHarness({                                                │
    │    provider,          // Same LLM provider as parent               │
    │    strategy: subagentStrategy,  // Custom prompt from parent       │
    │    missionId: childMissionId,                                      │
    │    tenantId: 'subagent',         // Isolation marker               │
    │    tools: config.tools           // Explicit tool binding          │
    │  })                                                               │
    └────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
    ┌────────────────────────────────────────────────────────────────────┐
    │  NlahHarness detects tenantId === 'subagent'                       │
    │  Filter: remove delegate_task to prevent recursion                  │
    │  childHarness.runMission(childState, childOnPacket)                │
    └────────────────────────────────────────────────────────────────────┘
```

---

## Entry Points & Exports

+--------------------+----------------------------------+--------------------------------------------+
| Export             | Source                           | Type                                       |
+--------------------+----------------------------------+--------------------------------------------+
| `toolRegistry`     | `registry.ts`                    | `ToolRegistry` singleton                   |
| `ToolRegistry`     | `registry.ts`                    | Class with autoload, resolveTools, getAllTools, connectMCPServer, addRestTool |
| `LAZY_TOOLS`       | `registry.ts`                    | Static lazy-loading map                    |
| `ACTIVE_FEATURES`  | `registry.ts`                    | Feature catalog array                      |
+--------------------+----------------------------------+--------------------------------------------+

---

## CredentialManager

Each `ToolRegistry` holds its own `readonly credentialManager = new CredentialManager()` instance, separate from the one in `index.ts`. This ensures tool-scoped credential isolation:

- MCP credentials are registered during `connectMCPServer()` via `config.credentials`
- REST headers/params are registered during `addRestTool()` via `config.headers` / `config.params`
- The credential manager is used internally but also exposed for direct access by credential-aware tools

---

## ToolRetriever (Consumer)

`getAllTools()` output is consumed by `ToolRetriever` — a keyword/semantic filter that selects relevant tools for a given mission prompt:

```typescript
class ToolRetriever {
  constructor(private allTools: ToolDefinition[]) {}

  getRelevantTools(query: string): ToolDefinition[] {
    // keyword match on tool.description + tool.keywords
    // returns subset of allTools
  }
}
```

The harness delegates tool selection to `ToolRetriever` when no explicit `features[]` array is provided. This decouples tool discovery from tool registration.

**Data flow:**

```
ToolRegistry.getAllTools()
    │
    ▼  (flat array of all 3 sources)
ToolRetriever.getRelevantTools(missionPrompt)
    │
    ▼  (scored subset)
AgentHarness → Map<string, ToolDefinition> → LLM tool calls
```

---

## Double-Load Prevention

`autoload()` scans the `definitions/` directory and dynamically imports every module. `LAZY_TOOLS` also statically maps the same tool IDs to import functions (used by `resolveTools()`). Because ESM caches imports by file URL, a relative vs. absolute path difference can cause the *same module to be loaded twice*, resulting in duplicate tool entries.

To prevent this, `resolveTools()` must guard against already-loaded tools:

```typescript
async resolveTools(features?: string[]): Promise<ToolDefinition[]> {
  // ...
  for (const featureId of features) {
    if (this.tools.has(toolName)) continue; // ← skip if autoload already registered it
    // ... lazy import
  }
}
```

This check ensures that tools loaded by `autoload()` (via `this.tools.set()`) are not duplicated when `resolveTools()` subsequently lazy-imports the same module. The canonical source is `this.tools`; `LAZY_TOOLS` serves only as a fallback resolver keyed by feature ID.

---

## Dependencies

+----------------------+--------------------------------------------------------------+
| Dependency           | Purpose                                                      |
+----------------------+--------------------------------------------------------------+
| `shared/types`       | `ToolDefinition`                                             |
| `node:fs/promises`   | `readdir` for autoload                                       |
| `shared/utils/logger`| Logging                                                      |
| `zod`                | Schema validation in tool definitions                        |
| `@langchain/core/messages` | Message types                                          |
| `AgentHarness`       | Sub-agent harness (delegation)                               |
| `AnchorFactory`      | Sub-agent state anchor                                       |
| `MCPClient`          | MCP server transport client (infra/transports/mcp)           |
| `RestToolAdapter`    | REST tool adapter (infra/transports/rest)                    |
| `CredentialManager`  | Tool-scoped credential isolation                             |
+----------------------+--------------------------------------------------------------+

---

## Source References

+--------------------------+------------------------------------------+-------------------------------------------------------+
| Ref                      | File                                     | Key Lines                                             |
+--------------------------+------------------------------------------+-------------------------------------------------------+
| LAZY_TOOLS map           | `registry.ts:13-17`                      | Static imports for 3 tools                            |
| ACTIVE_FEATURES          | `registry.ts:20-24`                      | 3 entries with id, name, tier                          |
| autoload()               | `registry.ts:31-69`                      | `readdir` + dynamic `import()` for each module        |
| resolveTools()           | `registry.ts:75-99`                      | Resolves by feature ID or falls back to all           |
| Delegate filter          | `harness/nlah/harness.ts:108-113`        | Sub-agents filter out delegate_task                   |
| Tool map                 | `harness/nlah/harness.ts:121`            | `Map<string, ToolDefinition>` for O(1) lookup         |
| Web search flow          | `definitions/web-search/index.ts:57-94`  | DDG HTML parse → Observation                          |
| Planning flow            | `definitions/planning/index.ts:19-74`    | Validate → mkdir → writeFile(STATE.md)                |
| Delegation flow          | `definitions/delegation/index.ts:17-134` | Child harness → sub-agent execution → relay           |
+--------------------------+------------------------------------------+-------------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
