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

> **Note:** The following constant files were described in a previous version of this document but do not currently exist in code:
> - `shared/constants/memory.ts`
> - `shared/constants/jwt.ts`
> - `shared/constants/mcp.ts`
> - `shared/constants/session.ts`
> - `shared/constants/skills.ts`
> - `shared/constants/credentials.ts`
>
> JWT-related constants are in `config/env.constants.ts` (SERVICE_JWT_ALGORITHM), MCP transport constants are in `infrastructure/transports/mcp/client.ts`, and retriever constants are in `core/agent/services/retriever.constants.ts`. These may be consolidated in the future.

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
| `infrastructure/providers/constants/index.ts`    | 1-34                        | Local URL detection, pricing models               |
| `core/agent/services/retriever.constants.ts`     | 1-12                        | Retriever config, weights, fallback               |
+--------------------------------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
