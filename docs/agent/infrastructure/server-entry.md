================================================================================
  Server Entry - Application Entry Point and Bootstrap Lifecycle
================================================================================
  Module    : Server Entry
  Service   : agent
  Version   : 2.0
  Updated   : 2026-07-09
================================================================================

## Description

The server starts at `src/index.ts` which performs environment validation,
telemetry initialization, tool autoloading, state provider and credential
manager setup, filesystem cleanup, and Hono application bootstrapping.
The configuration layer uses Zod for environment variable validation with
defaults and clear error reporting.

External connections (LLM providers, backend, MCP, REST) are created and
managed by the mission controller per-request using `ProviderFactory` and
`ToolRegistry`. See the [Adapter Layer](../application/features/adapter/adapter-architecture.md)
for the planned unified connection management architecture.

---

## File Structure

```
src/
  index.ts                    # Application entry point
  config/
    env.ts                    # Parsed & validated ENV export
    env.schema.ts             # Zod schema for environment variables
    env.constants.ts          # Default values, valid values, error messages
  core/agent/
    storage/
      backend.ts              # BackendStateProvider — Go backend HTTP calls
      memory.ts               # InMemoryStateProvider — local cache
      factory.ts              # Singleton stateStorage instance
    credentials/
      manager.ts              # CredentialManager — env var resolution
  infrastructure/
    providers/                # LLM provider implementations
      openai/
      anthropic/
      lm-studio/
      opencode-go/
      factory.ts
    transports/
      mcp/                    # MCP client (SSE/stdio)
      rest/                   # REST tool adapter
```

---

## Environment Configuration

### env.schema.ts — Zod Schema

```
// Zod schema fields
PORT:                  z.string().default("3001")
GRPC_PORT:             z.string().default("50051")
CHROMA_URL:            z.string().default("http://localhost:8000")  <!-- PLANNED: No ChromaDB client is implemented yet -->
LLM_MODEL_API_URL:     z.string().default("http://127.0.0.1:1234")
STATE_BACKEND:         z.enum(["memory", "backend"]).default("memory")
NODE_ENV:              z.enum(["development","production","test"]).default("development")
DEBUG_PROMPT:          z.boolean().default(false)
INTERNAL_AUTH_TOKEN:   z.string()          // REQUIRED
LANGFUSE_PUBLIC_KEY:   z.string()          // REQUIRED
LANGFUSE_SECRET_KEY:   z.string()          // REQUIRED
LANGFUSE_BASE_URL:     z.string().default("http://localhost:3000")
AGENT_RUNTIME_MODE:    z.enum(["local","saas"]).default("local")
SERVICE_JWT_SECRET:    z.string()          // REQUIRED — inter-service JWT signing key
BACKEND_INTERNAL_URL:  z.string().default("http://localhost:8080")  // Go backend internal URL
MCP_SERVER_URL:        z.string().url().optional()
ENABLE_MCP:            z.coerce.boolean().default(false)
ENABLE_REST_TOOLS:     z.coerce.boolean().default(false)
```

### env.constants.ts — New Entries

```
ENV_DEFAULTS = {
  PORT: "3001", GRPC_PORT: "50051", CHROMA_URL: "http://localhost:8000", ...
  SERVICE_JWT_SECRET: "",               // No default — must be configured in production
  BACKEND_INTERNAL_URL: "http://localhost:8080",
}
ENV_VALUES = {
  STATE_BACKENDS: ["memory", "backend"],
  ENVIRONMENTS: ["development", "production", "test"],
  RUNTIME_MODES: ["local", "saas"],
}
ENV_VALIDATION_MESSAGES = {
  INTERNAL_AUTH_TOKEN: "...",
  LANGFUSE_PUBLIC_KEY: "...",
  ...
  SERVICE_JWT_SECRET: "⚠️ SERVICE_JWT_SECRET is required for inter-service JWT authentication!",
}
```

### New Environment Variables

+------------------------+-------------------------------+---------------------------------------------+
| Variable               | Default                       | Purpose                                     |
+------------------------+-------------------------------+---------------------------------------------+
| `SERVICE_JWT_SECRET`   | _(required)_                  | HMAC secret for signing inter-service JWTs  |
| `BACKEND_INTERNAL_URL` | `http://localhost:8080`        | Base URL for the Go backend (memory client, |
|                        |                               | credential manager, skills library)         |
| `MCP_SERVER_URL`       | _(optional)_                  | MCP SSE endpoint for tool discovery         |
| `ENABLE_MCP`           | `false`                       | Enable MCP client on startup                |
| `ENABLE_REST_TOOLS`    | `false`                       | Enable REST tool adapters                   |
+------------------------+-------------------------------+---------------------------------------------+

---

## Flow Diagram — Bootstrap Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────┐
│              npm run dev (bun --watch src/index.ts)                       │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  1. import "./config/env"     → Zod safeParse of process.env            │
│     ┌─ validation fails      → print formatted errors → exit(1)         │
│     └─ validation passes     → export ENV = parsedEnv.data              │
│                                                                           │
│     New fields validated: SERVICE_JWT_SECRET, BACKEND_INTERNAL_URL       │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  2. import "./utils/telemetry" → OpenTelemetry NodeSDK.start()           │
│                                  → LangfuseSpanProcessor                 │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  3. Autoload Agent Tools     → toolRegistry.autoload()                  │
│                                  → Scan definitions/ directory          │
│                                  → Dynamic import each tool module      │
│                                  → Register in Map<name, ToolDefinition>│
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  4. State Provider & Credential Manager Initialization                  │
│                                  → import BackendStateProvider          │
│                                  → new BackendStateProvider(             │
│                                      BACKEND_INTERNAL_URL)              │
│                                  → import CredentialManager             │
│                                  → new CredentialManager()              │
│                                  → If ENABLE_MCP && MCP_SERVER_URL:     │
│                                    log MCP server URL (init done at     │
│                                    mission time via ToolRegistry)       │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  6. Startup Cleanup           → rmSync(debug/, logs/)                   │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  7. Create Hono App           → new Hono()                              │
│     ├─ app.use("*", cors())                                             │
│     ├─ app.use("*", monitorMiddleware)                                  │
│     ├─ app.use("/api/*", authMiddleware)                                │
│     ├─ app.get("/", health check)                                       │
│     ├─ app.route("/api", routes)                                        │
│     └─ app.onError(errorHandler)                                        │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  8. Export default { port, fetch, idleTimeout }                          │
│     Bun/Hono Node Server listening on PORT (default: 3001)              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Entry Points & Exports

### config/env.ts

```typescript
export const ENV: EnvConfig;   // Parsed, validated environment variables
export default ENV;
```

The `EnvConfig` type now includes:
- `SERVICE_JWT_SECRET: string`
- `BACKEND_INTERNAL_URL: string`
- `MCP_SERVER_URL: string | undefined`
- `ENABLE_MCP: boolean`
- `ENABLE_REST_TOOLS: boolean`

### config/env.schema.ts

See the Environment Configuration section above for the complete schema.

### config/env.constants.ts

```
ENV_DEFAULTS = {
  PORT: "3001", GRPC_PORT: "50051", CHROMA_URL: "http://localhost:8000",
  LLM_MODEL_API_URL: "http://127.0.0.1:1234", LANGFUSE_BASE_URL: "http://localhost:3000",
  BACKEND_INTERNAL_URL: "http://localhost:8080",           // NEW
  ...
}
ENV_VALUES = {
  STATE_BACKENDS: ["memory", "backend"],
  ENVIRONMENTS: ["development","production","test"],
  RUNTIME_MODES: ["local","saas"]
}
ENV_VALIDATION_MESSAGES = {
  INTERNAL_AUTH_TOKEN: "...",
  LANGFUSE_PUBLIC_KEY: "...",
  SERVICE_JWT_SECRET: "⚠️ SERVICE_JWT_SECRET is required for inter-service JWT auth!",
  ...
}
```

### src/index.ts

```typescript
// Step 1-2: Side-effect imports for env + telemetry
import "./config/env";
import "./utils/telemetry";

// Step 3: Autoload built-in tools
await toolRegistry.autoload();

// Step 4: Initialize state provider and credential manager
import { BackendStateProvider } from "./core/agent/storage/backend";
import { CredentialManager } from "./core/agent/credentials/manager";

const memoryProvider = new BackendStateProvider(ENV.BACKEND_INTERNAL_URL);
const credentialManager = new CredentialManager();

// Conditional MCP client setup
if (ENV.ENABLE_MCP && ENV.MCP_SERVER_URL) {
  logger.info(`MCP server configured at ${ENV.MCP_SERVER_URL}`);
}

export default {
  port: parseInt(ENV.PORT, 10),
  fetch: app.fetch,
  idleTimeout: 255,
};
```

### Backend Storage Provider

> [!NOTE]
> **Planned Refactoring**: The target architecture documents define a unified adapter directory (`adapter/backend/memory.adapter.ts` and `adapter/manager.ts`). In the current implementation, the connection and storage provider is located in `src/core/agent/storage/backend.ts` and initialized directly in `src/index.ts`.

The storage provider (`core/agent/storage/backend.ts`) communicates with the Go backend via the internal network using `BACKEND_INTERNAL_URL` as the base URL. It is used by the agent harness to persist and retrieve session state, conversation history, and key-value store entries.

---

## Dependencies

+---------------------------+-------------+---------------------------------------------------+
| Dependency                | Version     | Usage                                             |
+---------------------------+-------------+---------------------------------------------------+
| `hono`                    | ^4.12.18    | HTTP framework                                    |
| `@hono/node-server`       | ^2.0.1      | Node.js server adapter                            |
| `zod`                     | ^4.4.3      | Environment variable schema parsing               |
| `@opentelemetry/sdk-node` | ^0.218.0    | Telemetry initialization                          |
| `core/agent/storage/backend` | src/     | BackendStateProvider for session & message store |
| `core/agent/credentials/manager` | src/ | CredentialManager for dynamic credentials         |
| `node:fs`                 | built-in    | Startup cleanup (rmSync)                          |
| `node:path`               | built-in    | Path resolution                                   |
| `node:url`                | built-in    | fileURLToPath for __dirname equivalent            |
| `jsonwebtoken` / `jose`   | external    | JWT signing for inter-service auth                |
+---------------------------+-------------+---------------------------------------------------+

---

## Source References

+----------------------------------+-----------------------------+---------------------------------------------------+
| File                             | Line                        | Description                                       |
+----------------------------------+-----------------------------+---------------------------------------------------+
| `src/index.ts`                   | 1-2                         | Side-effect imports for env + telemetry           |
| `src/index.ts`                   | 20                          | `toolRegistry.autoload()` — built-in tools        |
| `src/index.ts`                   | 29-30                       | BackendStateProvider init                         |
| `src/index.ts`                   | 33-34                       | CredentialManager init                            |
| `src/index.ts`                   | 43-46                       | Hono app construction, middleware, routes, error  |
| `src/index.ts`                   | 61-65                       | Default export (port, fetch, idleTimeout)         |
| `src/config/env.ts`              | 1-19                        | Zod safeParse, error output, ENV export           |
| `src/config/env.schema.ts`       | 8-33                        | Zod schema with SERVICE_JWT_SECRET,               |
|                                 |                             |   BACKEND_INTERNAL_URL                            |
| `src/config/env.constants.ts`    | 1-22                        | Defaults, valid values, validation messages       |
| `src/core/agent/storage/backend.ts` | 1-100                    | BackendStateProvider network API calls            |
| `src/core/agent/credentials/manager.ts` | 1-50                 | CredentialManager store implementation             |
+----------------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
