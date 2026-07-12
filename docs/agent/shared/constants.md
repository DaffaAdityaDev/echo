================================================================================
  Constants - Shared Constants Across the Agent Service
================================================================================
  Module    : Constants
  Service   : agent
  Version   : 2.0
  Updated   : 2026-07-09
================================================================================

## Description

Constants are organized by domain concern across multiple files. They cover LLM
API configuration, error types and messages, middleware/auth/monitor parameters,
provider pricing models, retriever scoring weights, memory client endpoints,
service JWT configuration, MCP server config, session defaults, skills library
settings, and credential manager parameters.

---

## File Structure

```
src/shared/constants/
  index.ts               # LLM API versions, model config, paths
  errors.ts              # Error type tags and user-facing messages
  middleware.ts          # Auth and monitor header/key constants
  memory.ts              # Memory client endpoints and headers
  jwt.ts                 # Service JWT constants
  mcp.ts                 # MCP client config and defaults
  session.ts             # Session configuration defaults
  skills.ts              # Skills library constants
  credentials.ts         # Credential manager constants

src/infrastructure/providers/constants/
  index.ts               # Pricing models, local URL detection

src/core/agent/services/
  retriever.constants.ts # Tool retriever weights and limits
```

---

## LLM & API Constants (shared/constants/index.ts)

```typescript
LLM_API_VERSIONS = {
  V1: "/v1",
  V2: "/v2",
  LM_STUDIO_NATIVE: "/v1"
};

LLM_CONFIG = {
  DEFAULT_TEMPERATURE: 0.7,
};

PATHS = {
  STATE_ROOT: join(SA_OUTPUT_PATH || cwd(), 'runtime'),
  ARTIFACTS_ROOT: join(SA_OUTPUT_PATH || cwd(), 'artifacts'),
};
```

+----------------------------+---------------------------------------------+------------------------------------------+
| Constant                   | Value                                       | Purpose                                  |
+----------------------------+---------------------------------------------+------------------------------------------+
| `LLM_API_VERSIONS.V1`      | `"/v1"`                                     | Standard API version path                |
| `LLM_CONFIG.DEFAULT_TEMPERATURE`| `0.7`                                   | Default LLM sampling temperature         |
| `PATHS.STATE_ROOT`         | `{SA_OUTPUT_PATH}/runtime`                 | Agent state file directory               |
| `PATHS.ARTIFACTS_ROOT`     | `{SA_OUTPUT_PATH}/artifacts`               | Artifact output directory                |
+----------------------------+---------------------------------------------+------------------------------------------+

---

## Error Constants (shared/constants/errors.ts)

```typescript
ERROR_TYPES = {
  APPLICATION_ERROR: "APPLICATION_ERROR",
  RATE_LIMIT: "RATE_LIMIT_ERROR",
  TIMEOUT: "TIMEOUT_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL_SERVER: "INTERNAL_SERVER_ERROR",
};

ERROR_MESSAGES = {
  RATE_LIMIT: "Upstream LLM Provider API rate limit exceeded. Please retry shortly.",
  TIMEOUT: "Upstream LLM Provider query timed out. Please retry.",
  BAD_REQUEST: "Malformed request payload body. Ensure valid JSON structure.",
  INTERNAL_SERVER: "Internal server error",
};
```

Used by `errorHandler` middleware (`src/app/middleware/error.ts`) to classify and
respond to errors.

---

## Middleware Constants (shared/constants/middleware.ts)

```typescript
AUTH_CONSTANTS = {
  BYPASS_PATH: "/",
  HEADER_AUTHORIZATION: "Authorization",
  HEADER_INTERNAL_TOKEN: "X-Internal-Token",
  HEADER_FORWARDED_FOR: "x-forwarded-for",
  BEARER_PREFIX: "Bearer ",
  DEFAULT_IP: "unknown",
  FORBIDDEN_MESSAGE: "Forbidden: Invalid or missing internal token credentials.",
};

MONITOR_CONSTANTS = {
  HEADER_REQUEST_ID: "x-request-id",
  HEADER_TRACEPARENT: "traceparent",
  DEFAULT_TRACEPARENT: "none",
  METHOD_POST: "POST",
  METHOD_PUT: "PUT",
  BODY_ERROR_SUMMARY: "Unparsed/Large Body",
  STATUS_OK: "OK",
  STATUS_ERR: "ERR",
};
```

---

## Memory Client Constants (shared/constants/memory.ts)

Defines endpoints and headers for the memory client, which communicates with
the Go backend via `BACKEND_INTERNAL_URL` to store and retrieve agent sessions.

```typescript
MEMORY_ENDPOINTS = {
  SESSION_CREATE:   "/api/v1/memory/sessions",
  SESSION_GET:      "/api/v1/memory/sessions/:id",
  SESSION_UPDATE:   "/api/v1/memory/sessions/:id",
  SESSION_DELETE:   "/api/v1/memory/sessions/:id",
  SESSION_LIST:     "/api/v1/memory/sessions",
  STORE_PUT:        "/api/v1/memory/store/:key",
  STORE_GET:        "/api/v1/memory/store/:key",
  STORE_DELETE:     "/api/v1/memory/store/:key",
};

MEMORY_HEADERS = {
  CONTENT_TYPE: "application/json",
  AUTHORIZATION_PREFIX: "Bearer ",
};

MEMORY_DEFAULTS = {
  TIMEOUT_MS: 5000,
  MAX_RETRIES: 3,
  RETRY_BACKOFF_MS: 1000,
};
```

+-----------------------------------+--------------------------------------------------+
| Constant                          | Value/Purpose                                    |
+-----------------------------------+--------------------------------------------------+
| `MEMORY_ENDPOINTS.SESSION_CREATE` | `POST /api/v1/memory/sessions`                  |
| `MEMORY_ENDPOINTS.STORE_PUT`      | `PUT /api/v1/memory/store/:key`                 |
| `MEMORY_DEFAULTS.TIMEOUT_MS`      | `5000` — HTTP request timeout                    |
| `MEMORY_DEFAULTS.MAX_RETRIES`     | `3` — Retry count on transient failures          |
+-----------------------------------+--------------------------------------------------+

---

## Service JWT Constants (shared/constants/jwt.ts)

Used by the auth middleware and memory client to sign/verify inter-service
communication tokens with `SERVICE_JWT_SECRET`.

```typescript
JWT_CONSTANTS = {
  ALGORITHM: "HS256",
  ISSUER: "echo-agent",
  EXPIRATION_SECONDS: 300,        // 5 minutes
  HEADER_NAME: "X-Service-JWT",
  BEARER_PREFIX: "Bearer ",
};

JWT_CLAIMS = {
  SERVICE_ROLE: "agent-service",
  VERSION: "1",
};
```

+----------------------------+---------------------------------------------------+
| Constant                   | Value                                             |
+----------------------------+---------------------------------------------------+
| `JWT_CONSTANTS.ALGORITHM`  | `"HS256"`                                         |
| `JWT_CONSTANTS.EXPIRATION_SECONDS`| `300` (5 min TTL for inter-service tokens)   |
| `JWT_CONSTANTS.HEADER_NAME`| `"X-Service-JWT"`                                 |
+----------------------------+---------------------------------------------------+

---

## MCP Constants (shared/constants/mcp.ts)

Configuration for the Model Context Protocol client that connects to external
MCP servers to discover and invoke tools at runtime.

```typescript
MCP_CONSTANTS = {
  DEFAULT_TRANSPORT: "stdio",       // stdio | sse | streamable-http
  DEFAULT_TIMEOUT_MS: 10000,
  DEFAULT_MAX_TOOLS: 50,
  RECONNECT_DELAY_MS: 2000,
  MAX_RECONNECT_ATTEMPTS: 3,
};

MCP_PROTOCOL = {
  JSON_RPC_VERSION: "2.0",
  METHODS: {
    TOOLS_LIST: "tools/list",
    TOOLS_CALL: "tools/call",
    RESOURCES_LIST: "resources/list",
    RESOURCES_READ: "resources/read",
  },
};

MCP_ERROR_CODES = {
  TOOL_NOT_FOUND: -32001,
  INVALID_PARAMS: -32002,
  INTERNAL_ERROR: -32003,
};
```

+----------------------------------+---------------------------------------------+
| Constant                         | Value                                       |
+----------------------------------+---------------------------------------------+
| `MCP_CONSTANTS.DEFAULT_TRANSPORT`| `"stdio"` — default MCP transport           |
| `MCP_CONSTANTS.DEFAULT_TIMEOUT` | `10000` ms — tool call timeout              |
| `MCP_PROTOCOL.METHODS.TOOLS_LIST`| `"tools/list"` — MCP JSON-RPC method       |
+----------------------------------+---------------------------------------------+

---

## Session Config Defaults (shared/constants/session.ts)

Default values for agent session parameters applied when a session is created
without explicit configuration.

```typescript
SESSION_DEFAULTS = {
  MAX_HISTORY_MESSAGES: 50,
  MAX_HISTORY_TOKENS: 8000,
  IDLE_TIMEOUT_MINUTES: 30,
  MAX_TOOL_CALLS_PER_STEP: 10,
  ALLOWED_TRANSPORTS: ["built-in", "mcp", "rest"],
  DEFAULT_STRATEGY: "nlah", // internal strategy when user selects "agent" mode
};

SESSION_LIMITS = {
  MAX_MISSION_DURATION_MINUTES: 60,
  MAX_CONCURRENT_MISSIONS: 5,
  MAX_TOOLS_PER_SESSION: 100,
};
```

+-----------------------------------+---------------------------------------------------+
| Constant                          | Value                                             |
+-----------------------------------+---------------------------------------------------+
| `SESSION_DEFAULTS.MAX_HISTORY_MESSAGES`| `50`                                          |
| `SESSION_DEFAULTS.IDLE_TIMEOUT_MINUTES`| `30`                                          |
| `SESSION_DEFAULTS.DEFAULT_STRATEGY`    | `"nlah"`                                     |
| `SESSION_LIMITS.MAX_MISSION_DURATION_MINUTES`| `60`                                        |
+-----------------------------------+---------------------------------------------------+

---

## Skills Library Constants (shared/constants/skills.ts)

Constants for the skills library that provides reusable capability bundles
for the agent.

```typescript
SKILLS_CONSTANTS = {
  SKILLS_DIR: "skills",
  MANIFEST_FILE: "SKILL.md",
  DEFAULT_SKILLS_PATH: join(SA_OUTPUT_PATH || cwd(), "skills"),
  MAX_SKILLS_PER_SESSION: 10,
  SKILL_REGISTRY_KEY: "skills:registry",
};

SKILL_LOAD_PHASES = {
  BOOT: "boot",
  SESSION_INIT: "session_init",
  DEFERRED: "deferred",
};
```

+------------------------------------+---------------------------------------------------+
| Constant                           | Value                                             |
+------------------------------------+---------------------------------------------------+
| `SKILLS_CONSTANTS.MANIFEST_FILE`   | `"SKILL.md"` — per-skill manifest                 |
| `SKILL_LOAD_PHASES.BOOT`           | `"boot"` — skills loaded at startup               |
| `SKILL_LOAD_PHASES.SESSION_INIT`   | `"session_init"` — skills loaded per session      |
+------------------------------------+---------------------------------------------------+

---

## Credential Manager Constants (shared/constants/credentials.ts)

Constants for the credential manager that securely stores and retrieves
API keys and secrets used by tools and providers.

```typescript
CREDENTIAL_CONSTANTS = {
  STORAGE_PREFIX: "cred:",
  KEY_SEPARATOR: ":",
  DEFAULT_TTL_HOURS: 24,
  MAX_CREDENTIAL_SIZE_BYTES: 4096,
  ENCRYPTION_ALGORITHM: "aes-256-gcm",
};

CREDENTIAL_NAMESPACES = {
  LLM_PROVIDER: "llm",
  MCP_SERVER: "mcp",
  REST_ENDPOINT: "rest",
  EXTERNAL_API: "external",
};

CREDENTIAL_ERRORS = {
  NOT_FOUND: "Credential not found",
  EXPIRED: "Credential has expired",
  DECRYPT_FAILED: "Failed to decrypt credential",
};
```

+----------------------------------+---------------------------------------------------+
| Constant                         | Value                                             |
+----------------------------------+---------------------------------------------------+
| `CREDENTIAL_CONSTANTS.DEFAULT_TTL_HOURS`| `24`                                         |
| `CREDENTIAL_CONSTANTS.ENCRYPTION_ALGORITHM`| `"aes-256-gcm"`                           |
| `CREDENTIAL_NAMESPACES.LLM_PROVIDER`| `"llm"`                                       |
+----------------------------------+---------------------------------------------------+

---

## Provider Pricing Constants (infrastructure/providers/constants/index.ts)

```typescript
LOCAL_URL_KEYWORDS = ["localhost", "127.0.0.1", "lm-studio", "local", "192.168.", "10."];

PRICING_MODELS = {
  GPT_4O_MINI:    { pattern: 'gpt-4o-mini',    inputRate: 0.15,  outputRate: 0.60,  cacheReadRate: 0.075 },
  GPT_4O:         { pattern: 'gpt-4o',          inputRate: 2.50,  outputRate: 10.00, cacheReadRate: 1.25  },
  CLAUDE_3_5_SONNET: { pattern: 'claude-3-5-sonnet', inputRate: 3.00, outputRate: 15.00, cacheReadRate: 0.30 },
  DEFAULT:        { inputRate: 1.50, outputRate: 6.00, cacheReadRate: 0.75 },
};
```

Used by `calculateUsageCost()` in `providers/utils/index.ts`:
- Local models (detected via `LOCAL_URL_KEYWORDS`) always return `$0.00` cost
- Cloud models are matched by pattern and priced per million tokens

---

## Retriever Constants (core/agent/services/retriever.constants.ts)

```typescript
RETRIEVER_CONFIG = {
  DEFAULT_LIMIT: 8,
  MIN_MATCH_SCORE: 0,
};

MATCH_WEIGHTS = {
  KEYWORD: 0.6,
  DESCRIPTION: 0.3,
  NAME: 0.1,
};

RETRIEVER_FALLBACK_TOOLS = ['web_search'] as const;
```

---

## Dependencies

+------------------+--------------------------------------------------------------+
| Dependency       | Usage                                                        |
+------------------+--------------------------------------------------------------+
| `node:path`      | `PATHS` resolution (`join`)                                  |
| `node:crypto`    | JWT signing/verification                                     |
| `node:http`      | Memory client HTTP calls                                     |
+------------------+--------------------------------------------------------------+

---

## Source References

+--------------------------------------------------+-----------------------------+---------------------------------------------------+
| File                                             | Line                        | Description                                       |
+--------------------------------------------------+-----------------------------+---------------------------------------------------+
| `shared/constants/index.ts`                      | 6-19                        | LLM versions, temperature, paths                  |
| `shared/constants/errors.ts`                     | 1-14                        | Error types and messages                          |
| `shared/constants/middleware.ts`                  | 1-20                        | Auth and monitor constants                        |
| `shared/constants/memory.ts`                     | 1-45                        | Memory client endpoints, defaults                 |
| `shared/constants/jwt.ts`                        | 1-18                        | Service JWT algorithm, expiry, headers            |
| `shared/constants/mcp.ts`                        | 1-40                        | MCP transport, protocol, error codes              |
| `shared/constants/session.ts`                    | 1-20                        | Session config defaults and limits                |
| `shared/constants/skills.ts`                     | 1-20                        | Skills library paths, load phases                 |
| `shared/constants/credentials.ts`                | 1-30                        | Credential storage, encryption, namespaces        |
| `infrastructure/providers/constants/index.ts`    | 1-34                        | Local URL detection, pricing models               |
| `core/agent/services/retriever.constants.ts`     | 1-12                        | Retriever config, weights, fallback               |
+--------------------------------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
