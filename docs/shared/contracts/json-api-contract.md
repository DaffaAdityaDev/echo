================================================================================
  JSON API CONTRACT
================================================================================
  Module    : JSON API Contract
  Service   : Shared / Contracts
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Cross-service request/response schemas for all Echo HTTP endpoints. Defines
payload shapes, error format, pagination, SSE events, status codes, and naming
convention.

## File Structure

+-------------------------------+--------------------------------------------+
| Location                      | Role                                       |
+-------------------------------+--------------------------------------------+
| backend/internal/handler/     |                                            |
|   auth_handler.go             | Login response shape                       |
|   chat_handler.go             | Chat request/response, feature response    |
| backend/internal/models/      |                                            |
|   models.go                   | ProviderCfg struct                         |
| backend/internal/constants/   |                                            |
|   routes/v1.go                | Path constants                             |
|   auth/jwt.go                 | Header constants                           |
| agent/src/app/api/missions/   |                                            |
|   mission.schema.ts           | Zod validation with dual naming            |
|   mission.controller.ts       | Schema usage, error format                 |
| agent/src/shared/types/       |                                            |
|   index.ts                    | HarnessPacket, MissionPayload type         |
| agent/src/shared/constants/   |                                            |
|   errors.ts                   | ERROR_TYPES taxonomy                       |
| frontend/web/src/features/    |                                            |
|   chat/types/index.ts         | StreamPacket frontend type                 |
|   chat/api/useChatStream.ts   | SSE packet handling                        |
+-------------------------------+--------------------------------------------+

## Naming Convention

+------------------+-----------------------------+------------------------------+
| Layer            | Convention                  | Example                      |
+------------------+-----------------------------+------------------------------+
| Go structs       | snake_case                  | tier_requirement,            |
| (JSON tags)      |                             |   provider_config            |
| Agent Zod        | camelCase + snake_case      | provides both via            |
| schemas          | alias                       |   preprocessor               |
| Agent TypeScript | camelCase                   | missionId, userId, orgId     |
| types            |                             |                              |
| Frontend types   | camelCase                   | toolName, missionId          |
| SSE events       | snake_case                  | tool_call, subagent_result   |
+------------------+-----------------------------+------------------------------+

**Agent schema preprocessor** (`mission.schema.ts:9-39`) normalizes both
conventions:

```
input.userId ?? input.user_id    -> userId
input.orgId ?? input.org_id      -> orgId
input.prompt || input.message    -> prompt
```

## Error Response Format

### Standard Error Shape

```json
{
  "error": "Human-readable error message",
  "details": "Optional technical details / stack info"
}
```

### Agent Validation Error

```json
{
  "error": "Validation failed",
  "details": {
    "_errors": [],
    "prompt": { "_errors": ["Required"] },
    "provider_config": { "_errors": ["Required"] }
  }
}
```

### Go Gateway Errors

+--------+---------------------------------------------------------------+-----------+
| Status | Error Message                                                 | Source    |
+--------+---------------------------------------------------------------+-----------+
| 400    | "Invalid request"                                             | Chat-     |
|        |                                                               | Handler   |
|        |                                                               | .Bind()   |
|        |                                                               | .JSON     |
| 400    | "Unknown model '{id}'"                                        | Chat-     |
|        |                                                               | Handler   |
|        |                                                               | ModelSvc  |
| 401    | "Unauthorized: Missing token"                                 | Auth      |
|        |                                                               | middleware |
| 401    | "Unauthorized: Invalid token"                                 | Auth      |
|        |                                                               | middleware |
| 403    | "Feature '{name}' requires a Pro subscription."               | Chat-     |
|        |                                                               | Handler   |
|        |                                                               | tier check|
| 403    | "Forbidden: Invalid or missing internal token authentication  | Agent     |
|        |   credentials."                                               | auth      |
|        |                                                               | middleware|
| 500    | "Failed to generate token"                                    | Auth-     |
|        |                                                               | Handler   |
|        |                                                               | login     |
| 500    | "Failed to create request to agent"                           | Chat-     |
|        |                                                               | Handler   |
| 500    | "Agent service unreachable"                                   | Chat-     |
|        |                                                               | Handler   |
| 500    | "Agent request failed"                                        | Chat-     |
|        |                                                               | Handler   |
|        |                                                               | (non-200  |
|        |                                                               | from      |
|        |                                                               | agent)    |
| 500    | "Failed to retrieve features"                                 | Chat-     |
|        |                                                               | Handler   |
+--------+---------------------------------------------------------------+-----------+

### Agent Error Types

```typescript
// agent/src/shared/constants/errors.ts
ERROR_TYPES = {
  APPLICATION_ERROR: "APPLICATION_ERROR",
  RATE_LIMIT: "RATE_LIMIT_ERROR",
  TIMEOUT: "TIMEOUT_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL_SERVER: "INTERNAL_SERVER_ERROR",
}
```

Error format from agent:

```json
{
  "error": "Execution failed",
  "details": "Detailed error message"
}
```

## HTTP Status Codes

+------+--------------------------------------------+-----------+
| Code | Usage                                      | Service   |
+------+--------------------------------------------+-----------+
| 200  | Success (JSON or SSE stream start)         | All       |
| 204  | Empty success (rare)                       | —         |
| 400  | Bad request / validation error             | Go, Agent |
| 401  | Missing/invalid JWT                        | Go        |
| 403  | Forbidden (wrong tier, bad internal token) | Go, Agent |
| 404  | Resource not found                         | Go        |
| 500  | Internal server error                      | Go, Agent |
| 501  | Not implemented                            | Go        |
|      |                                             | (register)|
+------+--------------------------------------------+-----------+

## SSE Event Format

### Event Types

Standard SSE with `data:` lines. No named `event:` fields — type is in the
JSON payload.

```
data: { "type": "metadata",     "missionId": "...", "meta": { ... } }
data: { "type": "reasoning",    "content": "I need to search for..." }
data: { "type": "content",      "content": "The answer is..." }
data: { "type": "tool_call",    "toolName": "web_search", "toolInput": {...} }
data: { "type": "tool_result",  "toolName": "web_search", "content": "..." }
data: { "type": "usage",        "meta": { "promptTokens": 100, "completionTokens": 50 } }
data: { "type": "todo",         "todos": [{ "id": "...", "description": "...", "status": "pending" }] }
data: { "type": "subagent_call",  "subagent": { "name": "...", "instruction": "...", "status": "calling" } }
data: { "type": "subagent_result","subagent": { "name": "...", "status": "completed", "result": "..." } }
data: { "type": "checkpoint",  ... }
data: { "type": "debug",       ... }
data: { "type": "ping" }
```

### StreamPacket (Frontend type)

```typescript
{
  type?: 'content' | 'reasoning' | 'tool_call' | 'tool_result' | 'metadata'
       | 'usage' | 'todo' | 'subagent_call' | 'subagent_result'
        | 'file_operation' | 'debug' | 'checkpoint',
  missionId?: string,
  content?: string,
  toolName?: string,
  toolInput?: Record<string, unknown>,
  meta?: MissionMeta | TokenUsage,
  todos?: Array<{ id, description, status }>,
  subagent?: { name, instruction, result?, status },
  fileOp?: { operation, path, preview? },
  seq?: number,
  timestamp?: number
}
```

### Heartbeat

```
: heartbeat

```

Sent every 15 seconds in SaaS mode to keep connection alive.

## Request/Response Schemas

### Auth

**POST /api/v1/auth/login**

```json
// Request
{
  "email": "string",
  "password": "string"  // optional in mock
}

// Response 200
{
  "token": "jwt-string",
  "user": {
    "id": "1",
    "name": "Test User",
    "email": "test@example.com"
  }
}
```

**POST /api/v1/auth/register**

```json
// Response 501 (Not Implemented)
{ "error": "Not implemented yet" }
```

### Chat

**POST /api/v1/chat** (Go -> proxied to Agent)

```json
// Request
{
  "message": "string",
  "model": "string",
  "mode": "standard | agent",
  "missionId": "string (optional)",
  "history": [
    { "role": "user | assistant", "content": "string" }
  ],
  "features": ["string (feature IDs)"],
  "skills": ["string (skill names)"]
}

// Response 200 -> SSE Stream (text/event-stream)
```

### Agent Internal: Generate Mission

**POST /api/generate-mission?mode=...** (Agent internal)

```json
// Request (Go -> Agent)
{
  "user_id": 1,
  "message": "string",
  "model": "string",
  "history": [{ "role": "string", "content": "string" }],
  "provider_config": {
    "type": "openai | anthropic | lm-studio | opencode-go",
    "base_url": "string",
    "api_key": "string (optional)",
    "model": "string"
  },
  "missionId": "string (optional)",
  "features": ["string (always sent — empty [] means 'no tools')"]
}

// Response 200 -> SSE Stream
```

### Agent Zod Schema (CreateMission)

```typescript
// Parsed from both query params + body
{
  prompt: string,              // required
  strategy: 'standard'|'agent',
  tenantId: string,            // default: 'local'
  userId: string,              // default: 'local'
  orgId: string,               // default: 'local'
  missionId: string | null,    // optional (generated if absent)
  model: string | null,        // optional
  provider_config: {
    type: 'openai'|'anthropic'|'lm-studio'|'opencode-go',
    base_url: string,
    api_key: string | null | undefined,
    model: string
  },
  features: string[] | null | undefined,
  history: Array<{ role: string, content: string }> | null | undefined
}
```

### Models

**GET /api/v1/models**

```json
// Response 200
{
  "models": [
    { "id": "gpt-4o", "name": "gpt-4o" },
    { "id": "opencode-go/deepseek-v4-flash", "name": "deepseek-v4-flash" }
  ]
}
```

Agent `/api/models` returns same shape but wraps OpenAI/LM Studio format:

```json
// Transforms from { data: [{ id: "..." }] } -> { models: [{ id, name }] }
```

### Features

**GET /api/v1/features**

```json
// Response 200
[
  {
    "id": "web_search",
    "name": "Web Search",
    "description": "Search the internet...",
    "locked": false
  },
  {
    "id": "code_execute",
    "name": "Code Execution",
    "description": "Run Python code...",
    "locked": true   // if user tier is "free" and feature requires "pro"
  }
]
```

### Agent Internal: Feature Catalog

**GET /api/features** (Agent internal, used by Go)

```json
// Response 200
[
  {
    "id": "web_search",
    "name": "Web Search",
    "description": "Search the internet...",
    "tier_requirement": "pro"
  }
]
```

### Agent Internal: Skills Catalog

**GET /api/skills** (Agent internal, used by Go)

Backend fetches only when `skills[]` is provided in the chat request.
Cached in Redis (10 min TTL).

```json
// Response 200
[
  {
    "name": "research",
    "description": "Deep research with web search and multi-source analysis",
    "preferredTools": ["web_search", "delegate_task"],
    "modifiers": { "temperature": 0.5, "maxTokens": 4096, "compression": true }
  }
]
```

## Pagination Format

Not yet implemented across all endpoints. Format TBD — will follow standard
offset-based:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Entry Points & Exports

- **Go request structs**: `ChatRequest`, `HistoryMessage`, `Feature`,
  `FeatureResponse` in `chat_handler.go`
- **Agent Zod schema**: `createMissionSchema` in `mission.schema.ts`
- **Frontend types**: `StreamPacket`, `Message`, `ThoughtStep` in
  `chat/types/index.ts`
- **Agent shared types**: `HarnessPacket`, `MissionPayload`, `ProviderEvent`
  in `shared/types/index.ts`
- **Error constants**: `ERROR_TYPES` in `agent/src/shared/constants/errors.ts`

## Dependencies

- **Schema validation**: Zod (agent), manual Go struct binding (fiber)
- **SSE**: `hono/streaming` (agent), `fiber.SendStreamWriter` (Go),
  `ReadableStream` (frontend)
- **JSON**: `encoding/json` (Go), native `JSON.parse` (agent/frontend)

## Source References

+-------------------------------------------------------+-------+--------------------------------------+
| File                                                  | Lines | Role                                 |
+-------------------------------------------------------+-------+--------------------------------------+
| backend/internal/handler/auth_handler.go              | 60-67 | Login response shape                 |
| backend/internal/handler/chat_handler.go              | 45-66,| Chat request/response, feature       |
|                                                       | 92-233|   response                            |
| agent/src/app/api/missions/mission.schema.ts          | 9-61  | Zod validation with dual naming      |
| agent/src/app/api/missions/mission.controller.ts      | 20-121| Schema usage, error format           |
| agent/src/shared/types/index.ts                       | 17-56 | HarnessPacket type (SSE packet shape)|
| agent/src/shared/constants/errors.ts                  | 1-14  | Error type taxonomy                  |
| frontend/web/src/features/chat/types/index.ts         | 62-95 | StreamPacket frontend type           |
| frontend/web/src/features/chat/api/useChatStream.ts   | 48-234| SSE packet handling                  |
+-------------------------------------------------------+-------+--------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
