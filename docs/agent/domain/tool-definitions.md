================================================================================
  Tool Definitions - Agent Tool Schema, Purpose, and Implementation
================================================================================
  Module    : Tool Definitions
  Service   : agent
  Version   : 2.0
  Updated   : 2026-07-09
================================================================================

## Description

All tools available to the agent are defined under `src/core/agent/tools/definitions/`.
Each tool is a self-contained module exporting a `ToolDefinition` object with a
Zod schema, a description, keywords, a `transport` type, and an `execute()` function.
Tools can originate from three distinct transport sources — **built-in**, **MCP**,
and **REST** — which the `ToolRegistry` resolves at startup and on-demand. MCP
and REST source implementations live in the
[Adapter Layer](../application/features/adapter/adapter-architecture.md)
(`adapter/mcp/` and `adapter/rest/`), which manages connection lifecycle,
health checks, and reconnection.

The registry is no longer purely static: it combines a built-in lazy-loading map,
dynamic MCP client tool wrappers, and REST endpoint wrappers into a unified map.

---

## Transport Types

+-----------+-----------+--------------------------------------------------------------+
| Transport | Source    | Description                                                  |
+-----------+-----------+--------------------------------------------------------------+
| built-in  | Local     | Standard tool modules in `definitions/` compiled at deploy   |
| mcp       | External  | Tools exposed by an MCP server, wrapped at runtime           |
| rest      | External  | Tools backed by a remote HTTP API, wrapped as ToolDefinition |
+-----------+-----------+--------------------------------------------------------------+

Every `ToolDefinition` carries a `transport` field that tells the registry and
the harness how to resolve and invoke the tool.

---

## File Structure

```
src/core/agent/tools/
  registry.ts             # ToolRegistry + ACTIVE_FEATURES catalog + source resolution
  definitions/            # Built-in tools (lazy-loaded)
    web-search/
      index.ts              # DuckDuckGo HTML search
      constants.ts          # Config, headers, parse patterns, templates
    planning/
      index.ts              # write_todos — plan/task management
      constants.ts          # Status markers, templates, config
    delegation/
      index.ts              # delegate_task — sub-agent spawning
      constants.ts          # Packet types, defaults, templates

# MCP and REST tool sources live in the adapter layer:
#   adapter/mcp/client.ts       — MCP client (connection lifecycle via ConnectionManager)
#   adapter/rest/adapter.ts     — REST tool wrapper (connection lifecycle via ConnectionManager)
```

---

## Tool: web_search

### Purpose

Searches the web via DuckDuckGo's HTML search page (no API key required).
Returns up to 5 results with title, URL, and snippet.

### Schema

```typescript
z.object({ query: z.string() })
```

### Execute Flow

```
  input.query
    → encodeURIComponent
    → fetch("https://html.duckduckgo.com/html/?q=...")
    → Regex parse: result__a / result__snippet blocks
    → Extract redirect URL from uddg= parameter
    → Return Observation { status, summary, data: { results } }
```

### Constants Highlights

+----------------------------+------------------------------------------------------+
| Constant                   | Value                                                |
+----------------------------+------------------------------------------------------+
| `SEARCH_CONFIG.NAME`       | `'web_search'`                                       |
| `SEARCH_CONFIG.MAX_RESULTS`| 5                                                    |
| `HTTP_HEADERS.USER_AGENT`  | `'Mozilla/5.0 (compatible; EchoAgent/1.0)'`          |
| `PARSE_PATTERNS.RESULT`    | Regex for DuckDuckGo result blocks                   |
+----------------------------+------------------------------------------------------+

## Tool: write_todos

### Purpose

Creates, updates, or reorganizes the agent's task plan. Writes a `STATE.md` file
to the `runtime/` directory with formatted markdown task list.

### Schema

```typescript
z.object({
  todos: z.array(z.object({
    id: z.string(),
    description: z.string(),
    status: z.enum(['pending', 'in_progress', 'done', 'failed'])
  }))
})
```

### Execute Flow

```
  input.todos
    → mkdir(STATE_ROOT)
    → Format markdown with status markers:
      [x] = done, [/] = in_progress, [!] = failed, [ ] = pending
    → writeFile(STATE.md)
    → Return Observation
```

### Status Markers

+----------------+-----------+
| Status         | Marker    |
+----------------+-----------+
| `done`         | `[x]`     |
| `in_progress`  | `[/]`     |
| `failed`       | `[!]`     |
| `pending`      | `[ ]`     |
+----------------+-----------+

---

## Tool: delegate_task

### Purpose

Delegates a specific sub-task to a child/sub-agent with an isolated harness
instance. Supports optional context forking (inherit parent message history).
Relays sub-agent streaming packets to the parent stream.

### Schema

```typescript
z.object({
  agentName: z.string(),
  instruction: z.string(),
  systemPrompt: z.string(),
  fork_context: z.boolean().default(false)
})
```

### Execute Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│       input.agentName + instruction + systemPrompt + fork_context         │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ┌─ Create child AgentHarness with custom strategy                       │
│  │   (systemPrompt = input.systemPrompt)                                 │
│  │                                                                        │
│  ┌─ Build child state:                                                   │
│  │   AnchorFactory.create().build()                                      │
│  │   + historyMessages (if fork_context)                                 │
│  │   + new HumanMessage(instruction)                                     │
│  │                                                                        │
│  ┌─ childHarness.runMission(childState, packet callback)                 │
│  │                                                                        │
│  │   Collect reasoning, tool_call, tool_result, content                  │
│  │   Relay packets to parent onPacket (if type in RELAY_TYPES)          │
│  │   Accumulate subAgentOutput                                           │
│  │                                                                        │
│  Return Observation { summary, data: { agentName, result, logs } }      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Constants Highlights

+-----------------------------------+--------------------------------------------+
| Constant                          | Value                                      |
+-----------------------------------+--------------------------------------------+
| `DELEGATION_CONFIG.NAME`          | `'delegate_task'`                          |
| `DELEGATION_DEFAULTS.STRATEGY_NAME`| `'subagent'`                              |
| `DELEGATION_DEFAULTS.TENANT_ID`   | `'subagent'`                               |
| `RELAY_TYPES`                     | `['reasoning', 'content', 'tool_call',    |
|                                   |   'tool_result', 'swarm_status']`          |
+-----------------------------------+--------------------------------------------+

---

## MCP Tool Wrapping

When the agent is configured with an MCP server endpoint, the MCP adapter
(`adapter/mcp/client.ts`) connects to the MCP server, retrieves its tool
catalog, and wraps each remote tool into a `ToolDefinition` with
`transport: 'mcp'`. Connection lifecycle (connect, health check, reconnect)
is managed by `ConnectionManager` (`adapter/manager.ts`).

### Wrapping Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│  MCPToolWrapper.init(mcpServerUrl)                                       │
│    → Connect via MCP transport (stdio | SSE | streamable HTTP)           │
│    → tools/list                                                          │
│    → For each MCP tool:                                                  │
│       ┌──────────────────────────────────────────────┐                   │
│       │  ToolDefinition {                            │                   │
│       │    name:        mcpTool.name,                │                   │
│       │    description: mcpTool.description,         │                   │
│       │    schema:      mcpTool.inputSchema → Zod,   │                   │
│       │    keywords:    ['mcp', ...mcpTool.tags],    │                   │
│       │    transport:   'mcp',                       │                   │
│       │    execute:     async (input) => {           │                   │
│       │      return mcpClient.callTool(name, input)  │                   │
│       │    }                                         │                   │
│       │  }                                           │                   │
│       └──────────────────────────────────────────────┘                   │
│    → Register each into toolRegistry                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

The `execute()` function maps the input through the MCP protocol:
1. Serializes Zod-validated input to JSON-RPC params
2. Calls `tools/call` on the MCP server
3. Deserializes the JSON-RPC result
4. Wraps it in an `Observation` with status mapping

---

## REST Tool Wrapping

When a REST endpoint is registered as a tool source, the REST adapter
(`adapter/rest/adapter.ts`) creates a `ToolDefinition` with `transport: 'rest'`
backed by an HTTP call to an external microservice. Connection lifecycle is
managed by `ConnectionManager` (`adapter/manager.ts`).

### Wrapping Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│  RESTToolWrapper.register(endpoint, config)                              │
│    → Build ToolDefinition {                                              │
│       name:        config.name,                                          │
│       description: config.description,                                   │
│       schema:      z.object(config.params),       // JSON Schema → Zod   │
│       keywords:    config.keywords,                                      │
│       transport:   'rest',                                               │
│       execute:     async (input) => {                                    │
│         return fetch(config.url, {                                       │
│           method:  config.method || 'POST',                              │
│           headers: { 'Content-Type': 'application/json', ... },          │
│           body:    JSON.stringify(input)                                 │
│         }).then(r => r.json())                                           │
│       }                                                                  │
│     }                                                                    │
│    → Register into toolRegistry                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

REST tools are defined declaratively in configuration (not code), allowing
operators to expose backend microservice endpoints as agent-callable tools
without writing a new definition module.

---

## Tool Registry

### registry.ts

The `ToolRegistry` has been extended to support multi-source resolution:

```typescript
// 1. Static Lazy-Loading Registry (built-in tools)
LAZY_TOOLS = {
  delegate_task:     () => import('./definitions/delegation'),
  write_todos:       () => import('./definitions/planning'),
  web_search:        () => import('./definitions/web-search'),
};

// 2. Active Feature catalog (exposed via GET /api/features)
ACTIVE_FEATURES = [
  { id: 'delegate_task',     name: 'Sub-Agent Delegation',      tier: 'pro'  },
  { id: 'web_search',        name: 'Web Search',                tier: 'free' },
  { id: 'write_todos',       name: 'Task Planning & Board',     tier: 'free' },
];
```

### Tool Resolution Flow

```
                    ┌─────────────────────────────────────┐
                    │       ToolRegistry (singleton)       │
                    │     tools: Map<string, ToolDef>      │
                    └────────────────┬────────────────────┘
                                      │
                     ┌────────────────┼────────────────┐
                     │                │                │
                     ▼                ▼                ▼
           ┌─────────────────┐ ┌──────────────────┐ ┌────────────────┐
           │   autoload()     │ │ initMCP()        │ │ initREST()      │
           │   (built-in)     │ │ (via adapter/    │ │ (via adapter/  │
           │                  │ │  mcp/client.ts)  │ │  rest/adapter) │
           └─────────────────┘ └──────────────────┘ └────────────────┘
                     │                │                │
                     ▼                ▼                ▼
           ┌─────────────────┐ ┌──────────────────┐ ┌────────────────┐
           │ readdir(defs/)  │ │ ConnectionMgr    │ │ ConnectionMgr  │
           │ import each     │ │ .create('mcp')   │ │ .create('rest')│
           │ LAZY_TOOLS      │ │ → health check   │ │ → health check │
           │ Register as     │ │ → discoverTools  │ │ → register     │
           │ built-in tool   │ │ → wrap as        │ │ → wrap as      │
           │                 │ │   ToolDefinition │ │   ToolDef      │
           │                 │ │ → register       │ │ → register     │
           │                 │ └──────────────────┘ └────────────────┘
           └─────────────────┘
                     │                │                │
                     └────────────────┼────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────────┐
                    │  tools.set(name, toolDef)            │
                    │  Map now contains:                   │
                    │    built-in tools (transport=built-in)│
                    │    MCP tools     (transport=mcp)     │
                    │    REST tools    (transport=rest)    │
                    └────────────────┬────────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────────┐
                    │  Harness resolves via:               │
                    │    toolRegistry.getTool(name)        │
                    │    → O(1) lookup                     │
                    │    → transport field tells harness   │
                    │      how to invoke (local / MCP /    │
                    │      HTTP call)                      │
                    └─────────────────────────────────────┘
```

### Resolve Order

`resolveTools(features[])` is only called when features are explicitly set.
If features is `undefined`, the resolver is skipped entirely and the harness
falls back to skills' `preferredTools` or `ToolRetriever`.

When called:

```
  For each featureId in features:
    1. Check LAZY_TOOLS[featureId]         → built-in
    2. If not found, check MCP registry    → mcp-sourced
    3. If not found, check REST registry   → rest-sourced
    4. If not found → warn and skip
```

**Key semantic:**
- `features: []` (empty array) means "explicitly no tools" — harness receives empty tool list
- `features: undefined` means "not specified" — harness falls back to skills/ToolRetriever

+--------------------+----------+---------------------------------------------------+
| Export             | Type     | Description                                       |
+--------------------+----------+---------------------------------------------------+
| `ToolRegistry`     | class    | autoload(), resolveTools(), getTool(), getAllTools()|
|                    |          | initMCP(), initREST(), registerTool()             |
| `toolRegistry`     | instance | Singleton used across the application             |
| `ACTIVE_FEATURES`  | const[]  | Feature catalog for API and UI                    |
+--------------------+----------+---------------------------------------------------+

### Updated ToolDefinition Contract

```typescript
interface ToolDefinition {
  name: string;                // Unique identifier
  description: string;         // Human-readable description
  schema: z.ZodObject<any>;    // Zod input schema
  keywords?: string[];         // Retrieval keywords
  transport: 'built-in' | 'mcp' | 'rest';  // Source of the tool
  execute: (input: any, config?: any) => Promise<Observation>;
  /** Optional metadata for MCP/REST tools */
  endpoint?: string;           // MCP tool name or REST URL
  method?: string;             // HTTP method (REST tools only)
}
```

---

## Dependencies

+-----------------------------+--------------------------------------------------------------+
| Dependency                  | Usage                                                        |
+-----------------------------+--------------------------------------------------------------+
| `zod`                       | Schema definitions for all tools                             |
| `@langchain/core/messages`  | BaseMessage, HumanMessage in delegation                      |
| `AgentHarness`              | Child harness instantiation in delegate_task                 |
| `AnchorFactory`             | Message anchor creation in delegate_task                     |
| `LLMProvider`               | Provider interface for LLM calls in research and delegation  |
| `langfuseStorage`           | Agent activity logging context                               |
| `adapter/mcp/client`        | MCP protocol client (connection via ConnectionManager)       |
| `adapter/rest/adapter`      | REST tool invocation (connection via ConnectionManager)      |
+-----------------------------+--------------------------------------------------------------+

---

## Source References

+----------------------------------------+-----------------------------+---------------------------------------------------+
| File                                   | Line                        | Description                                       |
+----------------------------------------+-----------------------------+---------------------------------------------------+
| `definitions/web-search/index.ts`      | 57-94                       | Tool definition with DuckDuckGo HTML search       |
| `definitions/planning/index.ts`        | 19-74                       | write_todos state management                      |
| `definitions/delegation/index.ts`      | 17-134                      | Sub-agent delegation harness                      |
| `tools/registry.ts`                    | 13-17                       | LAZY_TOOLS static map                             |
| `tools/registry.ts`                    | 20-24                       | ACTIVE_FEATURES catalog                           |
| `tools/registry.ts`                    | 26-168                      | ToolRegistry class (autoload, resolveTools,       |
|                                        |                             |   initMCP, initREST, registerTool)                |
| `adapter/mcp/client.ts`                | 1-120                       | MCP client — connection, tool discovery, execution|
| `adapter/rest/adapter.ts`              | 1-80                        | REST adapter — HTTP endpoint → ToolDefinition     |
+----------------------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
