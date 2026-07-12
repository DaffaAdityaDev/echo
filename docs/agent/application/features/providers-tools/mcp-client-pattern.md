===============================================================================
  MCP Client Pattern - Tool Connection via Model Context Protocol
===============================================================================
  Module    : MCP Client Adapter
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
===============================================================================

## Description

MCP (Model Context Protocol) Client adapter that connects to external MCP
servers to discover and execute tools. Uses `@modelcontextprotocol/sdk` for
SSE and stdio transport, JSON Schema to Zod conversion for tool definitions,
and credential injection via the Credential Manager.

---

## File Structure

```
infrastructure/transports/mcp/
  client.ts               # MCPClient — connect, listTools, callTool
  types.ts                # McpServerConfig, McpToolDefinition
  schema-converter.ts     # JSON Schema → ZodObject conversion
```

---

## Flow Diagram

```
                    ┌───────────────────────────────────────────┐
                    │           User Config (Session)            │
                    │                                           │
                    │  mcp_servers: [                            │
                    │    { url: "https://mcp.example.com/sse",  │
                    │      credentials: { api_key: "$env.KEY" }}│
                    │  ]                                        │
                    └──────────────────┬────────────────────────┘
                                       │
                                       ▼
                    ┌───────────────────────────────────────────┐
                    │        MCPClient.connect(serverConfig)    │
                    │                                           │
                    │  1. Create transport (SSE / stdio)        │
                    │  2. Client({ name, version })             │
                    │  3. client.connect(transport)             │
                    └──────────────────┬────────────────────────┘
                                       │
                                       ▼
                    ┌───────────────────────────────────────────┐
                    │        tools/list → discover tools         │
                    │                                           │
                    │  MCP Response:                            │
                    │  { tools: [{ name, description,           │
                    │     inputSchema: JSON Schema }] }          │
                    │                                           │
                    │  schema-converter.ts:                     │
                    │    JSON Schema → ZodObject                │
                    └──────────────────┬────────────────────────┘
                                       │
                                       ▼
                    ┌───────────────────────────────────────────┐
                    │    Convert to ToolDefinition[]             │
                    │                                           │
                    │  { name, description, schema (Zod),       │
                    │    execute: (args) => client.callTool(    │
                    │      name, injectCredentials(args)        │
                    │    )                                      │
                    │  }                                        │
                    └──────────────────┬────────────────────────┘
                                       │
                                       ▼
                    ┌───────────────────────────────────────────┐
                    │         tools/call → execute tool          │
                    │                                           │
                    │  MCPClient.callTool(toolName, args):      │
                    │    1. CredentialManager.resolve(creds)    │
                    │       → inject $env refs with real values │
                    │    2. client.callTool({                   │
                    │         name: toolName,                   │
                    │         arguments: resolvedArgs           │
                    │       })                                  │
                    │    3. return Observation(                 │
                    │         result.content[0].text            │
                    │       )                                   │
                    └──────────────────┬────────────────────────┘
                                       │
                                       ▼
                    ┌───────────────────────────────────────────┐
                    │           Harness Integration              │
                    │                                           │
                    │  toolRegistry merges MCP tools +          │
                    │  built-in tools → unified tool list        │
                    │                                           │
                    │  Harness: provider sees uniform            │
                    │  ToolDefinition[] regardless of origin     │
                    └───────────────────────────────────────────┘
```

---

## Agent → MCP Server Interaction

```
  ┌──────────┐         ┌──────────────┐          ┌──────────────────┐
  │  Agent    │         │  MCP Client  │          │  User's MCP      │
  │  Harness  │         │  Adapter     │          │  Server          │
  └─────┬────┘         └──────┬───────┘          └────────┬─────────┘
        │                     │                           │
        │ connect(config)     │                           │
        │────────────────────►│                           │
        │                     │  GET /sse (or stdio)      │
        │                     │──────────────────────────►│
        │                     │                           │
        │                     │◄────── SSE stream ────────│
        │                     │                           │
        │ listTools()         │                           │
        │────────────────────►│                           │
        │                     │  tools/list               │
        │                     │──────────────────────────►│
        │                     │                           │
        │                     │◄── JSON Schema tools ─────│
        │◄─── ToolDefinition[]│                           │
        │                     │                           │
        │ callTool(name,args) │                           │
        │────────────────────►│                           │
        │                     │  CredentialManager         │
        │                     │  .resolve(creds)           │
        │                     │                           │
        │                     │  tools/call               │
        │                     │──────────────────────────►│
        │                     │                           │
        │                     │◄── tool result ───────────│
        │◄── Observation      │                           │
        │                     │                           │
```

---

## JSON Schema → Zod Conversion

MCP servers define tool input as JSON Schema. The adapter converts this to
Zod for internal compatibility with the `ToolDefinition` contract.

```typescript
// schema-converter.ts — mapping rules

JSON Schema type       →  Zod type
─────────────────────────────────────────────
{ type: "string" }     →  z.string()
{ type: "number" }     →  z.number()
{ type: "boolean" }    →  z.boolean()
{ type: "array" }      →  z.array(converted(items))
{ type: "object" }     →  z.object(converted(properties))
{ enum: [...] }        →  z.enum([...])
{ $ref: "#/defs/..." } →  deferred / manual
```

---

## Supported Transports

+----------+------------------------------------------------------------+------------------------------+
| Transport| Connection                                                  | Use Case                     |
+----------+------------------------------------------------------------+------------------------------+
| SSE      | `GET <url>/sse`, bidirectional streaming                    | Remote MCP servers           |
| stdio    | Spawn local process, communicate over stdin/stdout          | Local MCP servers, dev       |
+----------+------------------------------------------------------------+------------------------------+

---

## Error Handling

+---------------------------+----------------------------------------------------------+
| Failure Mode              | Behavior                                                  |
+---------------------------+----------------------------------------------------------+
| Server unreachable        | Retry (3x, exponential backoff), then return Observation  |
|                           | { status: 'error', summary: 'MCP server unreachable' }   |
| Connection timeout        | Default 30s timeout, throw on exceed                      |
| tools/list failure        | Return empty tool list, log warning                       |
| tools/call failure        | Return Observation { status: 'error', error: string }     |
| Invalid schema response   | Skip malformed tool, log, continue with valid tools       |
| Zone/standby mode         | Return Observation { status: 'warning' } with friendly    |
|                           | message ("service currently unavailable")                 |
+---------------------------+----------------------------------------------------------+

---

## Credential Injection Flow

```
User Config:
  { credentials: { api_key: "$env.MY_SERVICE_KEY" } }

At tools/call execution time:

  MCPClient.callTool(name, args):
    1. Look up credential mapping for this MCP server
    2. For each $env.<NAME> reference:
       a. CredentialManager.resolve("MY_SERVICE_KEY")
          → process.env.MY_SERVICE_KEY (real value)
       b. Inject resolved value into tool call arguments
       c. NEVER log or expose the resolved value
    3. client.callTool({ name, arguments: injectedArgs })
```

---

## Configuration

```typescript
interface McpServerConfig {
  name: string;                          // Logical name for logging
  transport: 'sse' | 'stdio';
  url?: string;                          // For SSE transport
  command?: string;                      // For stdio transport
  args?: string[];                       // For stdio transport
  credentials?: Record<string, string>;  // $env.<NAME> refs
  timeout?: number;                      // Default 30000ms
}
```

---

## Entry Points & Exports

+--------------------------+------------------------------------------+--------------------------------------------+
| Export                   | Source                                   | Type                                       |
+--------------------------+------------------------------------------+--------------------------------------------+
| `MCPClient`              | `infrastructure/transports/mcp/client.ts` | MCP connection + tool discovery/execution  |
| `McpServerConfig`        | `infrastructure/transports/mcp/types.ts`  | Server configuration interface             |
| `jsonSchemaToZod`        | `infrastructure/transports/mcp/schema-converter.ts` | JSON Schema → Zod converter   |
+--------------------------+------------------------------------------+--------------------------------------------+

---

## Dependencies

+----------------------------+--------------------------------------------------------------+
| Dependency                 | Purpose                                                      |
+----------------------------+--------------------------------------------------------------+
| `@modelcontextprotocol/sdk`| MCP client, transport (SSE/stdio), protocol types            |
| `zod`                      | Internal tool schema representation                          |
| `zod-to-json-schema`       | (Optional) Reverse conversion for provider binding           |
| `CredentialManager`        | Env reference resolution at execution time                   |
| `shared/types`             | `ToolDefinition`, `Observation`                              |
+----------------------------+--------------------------------------------------------------+

---

## Source References

+----------------------------+----------------------------------------------------------+-----------------------------------------+
| Ref                        | File (planned)                                           | Key Lines                               |
+----------------------------+----------------------------------------------------------+-----------------------------------------+
| MCP client connect         | `infrastructure/transports/mcp/client.ts`                | `new Client()`, `client.connect()`      |
| tools/list                 | `infrastructure/transports/mcp/client.ts`                | `client.listTools()`                    |
| tools/call                 | `infrastructure/transports/mcp/client.ts`                | `client.callTool()`                     |
| Schema converter           | `infrastructure/transports/mcp/schema-converter.ts`      | `jsonSchemaToZod()` recursion           |
| Credential injection       | `infrastructure/transports/mcp/client.ts`                | `CredentialManager.resolve(creds)`      |
| ToolDefinition merge       | `infrastructure/transports/mcp/client.ts`                | Returns array of `ToolDefinition`       |
+----------------------------+----------------------------------------------------------+-----------------------------------------+

===============================================================================
  (c) 2026 Echo - All Rights Reserved
===============================================================================
