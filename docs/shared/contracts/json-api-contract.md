================================================================================
  JSON API CONTRACT
================================================================================
  Module    : JSON API Contract
  Service   : Shared / Contracts
  Version   : 1.3
  Updated   : 2026-08-10 (optional model/mode overrides on chat request)
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
|   auth/handler.go             | Login response shape                       |
|   chat/handler.go             | Chat request/response, feature response    |
| backend/internal/models/      |                                            |
|   models.go                   | ProviderCfg struct                         |
| backend/internal/constants/   |                                            |
|   routes/v1.go                | Path constants                             |
|   auth/jwt.go                 | Header constants                           |
| agent/src/adapter/inbound/api/missions/   |                                            |
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
| Agent TypeScript | camelCase                   | sessionId, userId, orgId     |
| types            |                             |                              |
| Frontend types   | camelCase                   | toolName, sessionId          |
| SSE events       | snake_case                  | tool_call, subagent_result   |
+------------------+-----------------------------+------------------------------+

**Agent schema preprocessor** (`mission.schema.ts:9-39`) normalizes both
conventions:

```
input.userId ?? input.user_id    -> userId
input.orgId ?? input.org_id      -> orgId
input.sessionId ?? input.session_id -> sessionId
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
| 400    | "Provider config error: {err}"                                | Chat-     |
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
| <agent | "Agent request failed: {agent body}" — the agent's HTTP       | Chat-     |
| status | status code is passed through, NOT fixed to 500               | Handler   |
| code>  |                                                               |           |
| 500    | "Failed to retrieve features"                                 | Features- |
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

Error format from agent (error handler + auth middleware):

```json
{
  "status": "error",
  "error_type": "BAD_REQUEST",
  "message": "Human-readable description"
}
```

Auth rejection uses the same envelope with only `status` + `message`
(`AUTH_CONSTANTS.FORBIDDEN_MESSAGE`).

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
data: { "type": "metadata",     "missionId": "...", "content": "..." }
data: { "type": "reasoning",    "content": "I need to search for..." }
data: { "type": "content",      "content": "The answer is..." }
data: { "type": "tool_call",    "toolName": "web_search", "toolInput": {...} }
data: { "type": "tool_result",  "toolName": "web_search", "content": "..." }
data: { "type": "usage",        "usage": { "promptTokens": 100, "completionTokens": 50 } }
data: { "type": "todo",         "todos": [{ "id": "...", "description": "...", "status": "pending" }] }
data: { "type": "subagent_call",  "subagent": { "name": "...", "instruction": "...", "status": "calling" } }
data: { "type": "subagent_result","subagent": { "name": "...", "status": "completed", "result": "..." } }
data: { "type": "debug",       ... }
data: { "type": "system_notice",  "payload": { "level": "warning", "code": "LOOP_DETECTED", "message": "..." } }
data: { "type": "token_metrics",  "payload": { "promptTokens": 100, "completionTokens": 50, "totalTokens": 150, "estimatedCostUsd": 0.001 } }
data: { "type": "hitl_approval_required", "payload": { "approvalId": "...", "toolName": "...", "args": {...}, "riskLevel": "high", "expiresAt": 1712315678 } }
data: { "type": "mission_completed", "payload": { "completed": true, "totalSteps": 12, "totalCostUsd": 0.42, "durationMs": 83000 } }
```

All fields are flat — no `meta:` wrapper, no named SSE `event:` fields. The
`checkpoint` and `ping` packet types are never emitted; `swarm_status` and
`file_operation` are legacy types retained in the frontend's
`StreamPacket` union but never emitted by the harness.

### StreamPacket (Frontend type — Discriminated Union)

All packets share a base envelope, then vary by `type`:

```typescript
interface StreamPacketBase {
  missionId: string;
  step: number;
  seq: number;
  timestamp: number;
  agentStatus?: AgentStatus;
}

type StreamPacket =
  | (StreamPacketBase & { type: 'metadata'; content?: string; strategy?: string; historyDepth?: number; toolsAvailable?: string[]; objective?: string; maxIterations?: number; title?: string; summary?: string; })
  | (StreamPacketBase & { type: 'reasoning' | 'content'; content: string; })
  | (StreamPacketBase & { type: 'tool_call'; toolName: string; toolInput: Record<string, unknown>; })
  | (StreamPacketBase & { type: 'tool_result'; toolName: string; content: string; toolResult?: unknown; })
  | (StreamPacketBase & { type: 'tool_skip'; toolName: string; })
  | (StreamPacketBase & { type: 'todo'; todos: TodoItem[]; })
  | (StreamPacketBase & { type: 'subagent_call' | 'subagent_result'; subagent: SubagentInfo; })
  | (StreamPacketBase & { type: 'usage'; usage: TokenUsage; })
  | (StreamPacketBase & { type: 'progress'; phase: string; tokensUsed: number; tokensTotal: number; })
  | (StreamPacketBase & { type: 'heartbeat'; })
  | (StreamPacketBase & { type: 'state_change'; from: string; to: string; reason: string; })
  | (StreamPacketBase & { type: 'degraded'; from: string; to: string; reason: string; })
  | (StreamPacketBase & { type: 'turn_complete'; completed: boolean; totalIterations: number; totalCost: number; })
  | (StreamPacketBase & { type: 'debug'; rawSystemPrompt: string; currentHistoryLength: number; rawMessages: Array<{role, content}>; })
  | (StreamPacketBase & { type: 'error'; content: string; code?: string; })
  | (StreamPacketBase & { type: 'system_notice'; payload: { level: 'info'|'warning'|'error'; code: string; message: string }; })
  | (StreamPacketBase & { type: 'token_metrics'; payload: TokenUsage & { estimatedCostUsd: number }; })
  | (StreamPacketBase & { type: 'hitl_approval_required'; payload: HitlApproval; })
  | (StreamPacketBase & { type: 'mission_completed'; payload: { completed: boolean; totalSteps: number; totalCostUsd: number; durationMs: number }; });
```

Fields are **flat** — no `meta:` wrapper. `agentStatus` is present when the
agent has an active status tracker.

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
  "message": "string (required)",
  "sessionId": "string (optional — omit to create a new session)"
}

// Response 200 -> SSE Stream (text/event-stream)
// Response headers: X-Session-ID (always set — the session id in use;
//   the frontend reads it to learn the id of a newly created session)
```

> The chat request accepts `{ message, sessionId }` — nothing else is
> required. `model` and `mode` are OPTIONAL per-request overrides: when set,
> they take precedence over the user's defaults (used by clients without a
> user identity, e.g. the Discord bot's per-channel selection); the web client
> omits them. No `sessionId` → the gateway creates a new session (this message
> is turn 1). With `sessionId` → the message appends to that session
> (append-only, never replace). Model, mode, features, skills, and harness
> feature toggles are resolved SERVER-SIDE per request from the user's
> global settings (`user_preferences`, GET/PUT `/api/v1/settings`). History
> is always loaded server-side from the session's DB messages.

> **Strategy Lifecycle**: the gateway still resolves the strategy version
> server-side (session pin → rollout config, see
> `docs/shared/patterns/strategy-lifecycle.md`) and forwards it in the
> generate-mission payload — clients never supply it on the chat request.

### Session Interrupt

**POST /api/v1/sessions/{id}/cancel** (Go -> proxied to Agent)

```json
// Request: empty body
// Response 200: { "status": "ok" }
```

> Cancels the in-flight mission for a session. Idempotent: a session with no
> active run returns success without side effects. The gateway signals the
> agent's cancel endpoint (`POST /api/v1/sessions/{id}/cancel` internally),
> which aborts the in-flight LLM provider stream, and the turn is finalized as
> `interrupted` when the stream ends. A cancelled mission cannot be resumed:
> a late HITL approval for it is rejected (`409 MISSION_CANCELLED`), and
> sending a new message starts a fresh turn on the same session.

### Agent Internal: Generate Mission

**POST /api/generate-mission?mode=...** (Agent internal)

```json
// Request (Go -> Agent)
{
  "user_id": "1",
  "message": "string",
  "model": "string",
  "history": [{ "role": "string", "content": "string" }],
  "provider_config": {
    "type": "openai | anthropic | lm-studio | opencode-go",
    "base_url": "string",
    "api_key": "string (optional)",
    "model": "string"
  },
  "session_id": "string (always sent — the session id is the run id)",
  "features": ["string (always sent — empty [] means 'no tools')"],
  "skills": ["string (optional)"],
  "strategy_version": "string (optional, e.g. 'nlah:v1') [Active]"
}

// Response 200 -> SSE Stream
```

> The payload carries `strategy_version` only — there is no `strategy` key.
> `user_id` is a string.

### Agent Zod Schema (CreateMission)

```typescript
// Parsed from both query params + body
{
  prompt: string,              // required
  strategy: 'standard'|'agent',
  tenantId: string,            // default: 'local-developer'
  userId: string,              // default: 'local-dev-user'
  orgId: string,               // default: 'local-org'
  sessionId: string | null,    // optional (session id; a run id is generated if absent)
  model: string | null,        // optional
  provider_config: {
    type: 'openai'|'anthropic'|'lm-studio'|'opencode-go',
    base_url: string,
    api_key: string | null | undefined,
    model: string
  },                           // REQUIRED
  features: string[] | null | undefined,
  skills: string[] | null | undefined,
  history: Array<{ role: string, content: string }> | null | undefined,
  strategy_version: string | null | undefined   // Active — "nlah:v1"
  config: {                    // optional nested session config (camelCase)
    memory: { episodic: boolean, semantic: boolean, procedural: boolean, ttl: number },
    harness: {
      compression: { enabled: boolean, ratio: number, keepLastTurns: number },
      pacing: { enabled: boolean, threshold: number },
      loopDetection: { enabled: boolean, similarityThreshold: number },
      maxIterations: number,
      costCap: number,
      delegationDepth: number
    },
    harnessConfig?: { circuitBreaker?, degradation?, contextResolver?, agentStatus? },
    featureToggles?: {...},
    skills?: string[],
    mcpServers?: Array<{ name, url, command?, args?, transport, credentials? }>,
    restTools?: Array<{ name, endpoint, url?, method, description, headers?, global_headers?, inputSchema, auth?, timeout, url_interpolation }>
  }
}
```

Defaults come from `DEFAULT_MISSION_VALUES` (`mission.constants.ts`):
`tenantId: "local-developer"`, `userId: "local-dev-user"`,
`orgId: "local-org"`, `strategy: "agent"`.

### Strategy Catalog

**GET /api/v1/strategies** (Go Gateway, JWT) `[Active]`


```json
// Response 200 — agent shape: { strategies: [{ name, versions: [...] }] }
// (no top-level status per strategy)
{
  "strategies": [
    {
      "name": "standard",
      "versions": [
        {
          "version": "standard:v1",
          "status": "active",
          "aliases": ["chat"]
        }
      ]
    },
    {
      "name": "nlah",
      "versions": [
        {
          "version": "nlah:v1",
          "status": "active",
          "aliases": ["agent", "deep-research", "react", "sequential"]
        }
      ]
    }
  ]
}
```

The Go gateway's `GET /api/v1/strategies` wraps the same catalog and merges
the gateway-resolved `rollout` field per version. The agent's internal
`GET /api/strategies` returns the shape above with no rollout.

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

The agent's **implemented tool registry** — dynamically derived from its tool
registry (`getImplementedFeatures()`). No tier, no ui_schema: catalog
metadata lives in the backend `features` table (migration 009_create_features)
and is merged by Go. Unknown feature ids requested in
`POST /api/generate-mission` are rejected with HTTP 400
`{"error": "Unknown feature '<id>'"}`, mirroring skills validation.

```json
// Response 200
[
  {
    "id": "delegate_task",
    "name": "delegate_task",
    "description": "Delegate a specific sub-task or research query to a specialized child/sub-agent."
  },
  {
    "id": "web_search",
    "name": "web_search",
    "description": "Web search engine for real-time weather, prices, and current events."
  },
  {
    "id": "write_todos",
    "name": "write_todos",
    "description": "Create, update, or reorganize the agent's task plan (todo list)."
  }
]
```

### Agent Internal: Skills Catalog

**GET /api/skills** (Agent internal, used by Go)

Backend fetches only when the user's preferences list skills.
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
  `FeatureResponse` in `chat/handler.go`
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
| backend/internal/handler/auth/handler.go              | 60-67 | Login response shape                 |
| backend/internal/handler/chat/handler.go              | 45-66,| Chat request/response, feature       |
|                                                       | 92-233|   response                            |
| agent/src/adapter/inbound/api/missions/mission.schema.ts          | 9-61  | Zod validation with dual naming      |
| agent/src/adapter/inbound/api/missions/mission.controller.ts      | 29-130| Schema usage, error format           |
| agent/src/shared/types/index.ts                       | 56-80 | HarnessPacket discriminated union    |
| agent/src/shared/constants/errors.ts                  | 1-14  | Error type taxonomy                  |
| frontend/web/src/features/chat/types/index.ts         | 62-95 | StreamPacket frontend type           |
| frontend/web/src/features/chat/api/useChatStream.ts   | 48-234| SSE packet handling                  |
+-------------------------------------------------------+-------+--------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
