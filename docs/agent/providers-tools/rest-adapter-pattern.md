===============================================================================
  REST Adapter Pattern - Tool Connection via HTTP API
===============================================================================
  Module    : REST API Adapter
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
===============================================================================

## Description

REST API adapter for users who cannot run an MCP server. Tools are defined
statically in configuration (not discovered at runtime). The adapter maps
tool calls to HTTP requests against the user's API, with support for
custom headers, auth schemes, and credential injection.

---

## File Structure

```
infrastructure/transports/rest/
  adapter.ts              # RestAdapter — execute tool via HTTP
  types.ts                # RestToolConfig, RestAdapterConfig
```

---

## Flow Diagram

```
                    ┌───────────────────────────────────────────┐
                    │           User Config (Session)            │
                    │                                           │
                    │  rest_tools: [                             │
                    │    { name: "search_products",             │
                    │      url: "https://api.example.com/search",│
                    │      method: "POST",                       │
                    │      headers: { "X-API-Key": "$env.KEY" },│
                    │      schema: { ... }                       │
                    │    }                                      │
                    │  ]                                        │
                    └──────────────────┬────────────────────────┘
                                       │
                                       ▼
                    ┌───────────────────────────────────────────┐
                    │        RestAdapter(config)                 │
                    │                                           │
                    │  For each rest_tool entry:                 │
                    │    Parse schema → ZodObject                │
                    │    Build ToolDefinition:                   │
                    │      { name, description, schema,          │
                    │        execute: (args) => httpRequest() }  │
                    └──────────────────┬────────────────────────┘
                                       │
                                       ▼
                    ┌───────────────────────────────────────────┐
                    │         Tool Execution (HTTP)              │
                    │                                           │
                    │  RestAdapter.execute(toolName, args):      │
                    │    1. Look up tool config by name          │
                    │    2. CredentialManager.resolve(headers)   │
                    │       → replace $env refs with real values │
                    │    3. Build request:                      │
                    │       - URL interpolation with args        │
                    │       - Method + headers + body            │
                    │    4. fetch(url, { method, headers, body })│
                    │    5. Parse response → Observation         │
                    └──────────────────┬────────────────────────┘
                                       │
                                       ▼
                    ┌───────────────────────────────────────────┐
                    │           Harness Integration              │
                    │                                           │
                    │  Merged into same ToolDefinition[]         │
                    │  as built-in and MCP tools                 │
                    └───────────────────────────────────────────┘
```

---

## Agent → REST Adapter Interaction

```
  ┌──────────┐         ┌──────────────┐          ┌──────────────────┐
  │  Agent    │         │  REST        │          │  User's API      │
  │  Harness  │         │  Adapter     │          │  Endpoint        │
  └─────┬────┘         └──────┬───────┘          └────────┬─────────┘
        │                     │                           │
        │ callTool(name,args) │                           │
        │────────────────────►│                           │
        │                     │ CredentialManager          │
        │                     │ .resolve(headers)          │
        │                     │                           │
        │                     │  HTTP Request              │
        │                     │──────────────────────────►│
        │                     │                           │
        │                     │◄──── HTTP Response ───────│
        │◄── Observation      │                           │
        │                     │                           │
```

---

## REST vs MCP Comparison

+---------------------------+------------------------------------------------+------------------------------------------------+
| Aspect                    | MCP Client                                     | REST Adapter                                   |
+---------------------------+------------------------------------------------+------------------------------------------------+
| Tool discovery            | Runtime via `tools/list`                        | Static via config file                          |
| Transport                 | SSE or stdio                                    | HTTP/HTTPS                                      |
| Protocol                  | Model Context Protocol (standardized)           | User-defined REST API                           |
| Schema source             | Server-provided JSON Schema                     | User-provided Zod/JSON in config                |
| Real-time streaming       | Yes (SSE)                                       | No (request-response)                           |
| Setup effort              | Run an MCP server                               | Configure URL + headers + schema               |
| Best for                  | Tool-rich ecosystems, real-time needs           | Simple APIs, quick integration, limited access  |
| Credential model          | Per-server credential mapping                   | Per-tool header/auth injection                  |
+---------------------------+------------------------------------------------+------------------------------------------------+

---

## Configuration

```typescript
interface RestToolConfig {
  name: string;                             // Tool name used by the agent
  description: string;                      // Description for LLM prompt
  url: string;                              // API endpoint URL
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; // Default: POST
  headers?: Record<string, string>;         // Static + $env refs
  auth?: {                                  // Optional auth block
    type: 'bearer' | 'basic' | 'header';
    credentials: Record<string, string>;    // $env refs
  };
  schema: {                                 // JSON Schema for tool inputs
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  response_mapping?: {                      // Map HTTP response to Observation
    status_path?: string;                   // JSONPath to status field
    data_path?: string;                     // JSONPath to data field
  };
}

interface RestAdapterConfig {
  tools: RestToolConfig[];
  global_headers?: Record<string, string>;  // Applied to all tools
  timeout?: number;                         // Default: 30000ms
}
```

---

## Auth Schemes

+----------+-----------------------------+---------------------------------------------+
| Type     | Configuration               | Behavior                                    |
+----------+-----------------------------+---------------------------------------------+
| Bearer   | `{ type: "bearer",         | Sets `Authorization: Bearer <token>`        |
|          |   credentials: {            |                                             |
|          |     token: "$env.API_TOKEN" |                                             |
|          |   }}                        |                                             |
+----------+-----------------------------+---------------------------------------------+
| Basic    | `{ type: "basic",          | Sets `Authorization: Basic <base64(         |
|          |   credentials: {            |   user:pass)>`                               |
|          |     username: "$env.USER",  |                                             |
|          |     password: "$env.PASS"   |                                             |
|          |   }}                        |                                             |
+----------+-----------------------------+---------------------------------------------+
| Header   | `{ type: "header",         | Sets custom header with resolved value      |
|          |   credentials: {            |                                             |
|          |     "X-API-Key":           |                                             |
|          |       "$env.API_KEY"        |                                             |
|          |   }}                        |                                             |
+----------+-----------------------------+---------------------------------------------+

---

## Error Handling

+---------------------------+----------------------------------------------------------+
| Failure Mode              | Behavior                                                  |
+---------------------------+----------------------------------------------------------+
| HTTP 4xx                  | Return Observation{ status: 'error', summary: statusText }|
| HTTP 5xx                  | Retry (2x), then Observation{ status: 'error' }          |
| Network failure           | Return Observation{ status: 'error', error: 'NETWORK' }  |
| Timeout                   | Default 30s; return Observation{ status: 'error' }       |
| Invalid response          | Return Observation{ status: 'error', error: 'PARSE' }    |
| Missing $env ref          | Throw ConfigurationError at startup                       |
+---------------------------+----------------------------------------------------------+

---

## Entry Points & Exports

+--------------------------+--------------------------------------------------+--------------------------------------------+
| Export                   | Source                                           | Type                                       |
+--------------------------+--------------------------------------------------+--------------------------------------------+
| `RestAdapter`            | `infrastructure/transports/rest/adapter.ts`       | REST tool adapter                          |
| `RestToolConfig`         | `infrastructure/transports/rest/types.ts`         | Per-tool configuration                     |
| `RestAdapterConfig`      | `infrastructure/transports/rest/types.ts`         | Adapter configuration                      |
+--------------------------+--------------------------------------------------+--------------------------------------------+

---

## Dependencies

+----------------------+--------------------------------------------------------------+
| Dependency           | Purpose                                                      |
+----------------------+--------------------------------------------------------------+
| `zod`                | Schema validation for tool inputs                             |
| `CredentialManager`  | Env reference resolution at execution time                    |
| `shared/types`       | `ToolDefinition`, `Observation`                               |
| `node:fetch` / `fetch` | HTTP requests                                              |
+----------------------+--------------------------------------------------------------+

---

## Source References

+----------------------------+-------------------------------------------+------------------------------------------+
| Ref                        | File (planned)                            | Key Lines                                |
+----------------------------+-------------------------------------------+------------------------------------------+
| Adapter initialization     | `infrastructure/transports/rest/adapter.ts`| Parse config → ToolDefinition[]         |
| Tool execution             | `infrastructure/transports/rest/adapter.ts`| HTTP call + credential injection        |
| Auth builder               | `infrastructure/transports/rest/adapter.ts`| Bearer/Basic/Header resolvers           |
| Schema parsing             | `infrastructure/transports/rest/adapter.ts`| JSON Schema → Zod                        |
+----------------------------+-------------------------------------------+------------------------------------------+

===============================================================================
  (c) 2026 Echo - All Rights Reserved
===============================================================================
