================================================================================
  INTERNAL API CONTRACT
================================================================================
  Module    : Internal API Contract
  Service   : Shared / Contracts
  Version   : 1.0
  Updated   : 2026-08-05
================================================================================

## Description

Defines the request/response shapes for all internal (agent → backend) HTTP
endpoints. These endpoints are NOT exposed to end users or external clients.
All requests require a valid Service JWT in the `Authorization` header.

The agent signs a short-lived JWT per request using `SERVICE_JWT_SECRET`;
the backend verifies it using the same secret. See
`docs/shared/patterns/service-to-service-auth.md` for the full auth flow.

## Service JWT Header

Every request to an internal endpoint MUST include:

```
Authorization: Bearer <service-jwt>
```

### JWT Claims

```json
{
  "sub": "agent",
  "iat": 1712315678,
  "exp": 1712315738
}
```

| Claim | Value         | Description                     |
|-------+---------------+---------------------------------|
| sub   | "agent"       | Fixed service identifier        |
| iat   | Unix epoch    | Issued at (seconds)             |
| exp   | iat + 60s     | Expiry — short-lived            |

Algorithm: HS256
Secret: SERVICE_JWT_SECRET

## Base Path

All internal routes are under:

```
/api/v1/internal
```

## Endpoints

### 1. POST /api/v1/internal/memory/episodic/store

Store episodic memory (conversation turn / event).

#### Request

```json
{
  "session_id": "session-abc-123",
  "content": {
    "role": "assistant",
    "message": "The capital of France is Paris."
  },
  "metadata": {
    "session_id": "session-xyz-456",
    "type": "chat_turn"
  }
}
```

| Field         | Type   | Required | Description                                    |
|---------------+--------+----------+------------------------------------------------|
| session_id    | string | Yes      | Unique session identifier                      |
| content       | object | Yes      | Opaque episodic payload (any JSON, stored as-is)|
| metadata      | object | No       | Optional metadata                              |
| ttl_seconds   | number | No       | TTL override in seconds (default 24h)          |

The backend stamps a server-side `timestamp` (UTC) onto the entry — the
client does not supply it.

#### Response (201)

```json
{
  "id": "mem_ep_789",
  "status": "stored"
}
```

#### Error Response

```json
{
  "error": "session_id and content are required",
  "details": ""
}
```

---

### 2. POST /api/v1/internal/memory/episodic/recall

Recall episodic memories for a session.

#### Request

```json
{
  "session_id": "session-abc-123",
  "limit": 20
}
```

| Field      | Type   | Required | Description                    |
|------------+--------+----------+--------------------------------|
| session_id | string | Yes      | Unique session identifier      |
| limit      | number | No       | Max memories to return (default 50) |

#### Response (200)

```json
{
  "session_id": "session-abc-123",
  "entries": [
    {
      "content": { "role": "assistant", "message": "The capital of France is Paris." },
      "timestamp": "2026-07-09T12:00:00Z",
      "metadata": { "session_id": "session-xyz-456" }
    }
  ],
  "total": 42
}
```

Entries are stored in a Redis list per session (newest first); `timestamp`
and optional `metadata` are server-set at store time.

---

### 3. POST /api/v1/internal/memory/semantic/store

Store a semantic memory entry with an optional embedding.

#### Request

```json
{
  "id": "mem-sem-123",
  "content": "The capital of France is Paris.",
  "embedding": [0.012, -0.044],
  "metadata": { "source": "conversation" }
}
```

| Field     | Type    | Required | Description                             |
|-----------+---------+----------+-----------------------------------------|
| id        | string  | Yes      | Unique memory identifier                |
| content   | string  | Yes      | Memory text                             |
| embedding | number[]| No       | Optional vector; when present the row is indexed with it |
| metadata  | object  | No       | Optional metadata                       |

#### Response (201)

```json
{
  "id": "mem_sm_789",
  "status": "indexed"
}
```

---

### 4. POST /api/v1/internal/memory/semantic/search

Search semantic memories by query text.

#### Request

```json
{
  "query": "capital of France",
  "limit": 10
}
```

| Field     | Type    | Required | Description                              |
|-----------+---------+----------+------------------------------------------|
| query     | string  | Yes      | Search query text                        |
| embedding | number[]| No       | Accepted but unused (reserved)           |
| limit     | number  | No       | Max results (default 10)                 |
| threshold | number  | No       | Accepted but unused (reserved)           |

> Note: search is an ILIKE substring match on `content` — the
> `embedding` and `threshold` fields exist in the request schema but are
> not used by the current implementation.

#### Response (200)

```json
{
  "results": [
    {
      "id": "mem-sem-123",
      "content": "The capital of France is Paris.",
      "metadata": { "source": "conversation" },
      "created_at": "2026-07-09T12:00:00Z"
    }
  ]
}
```

---

### 5. POST /api/v1/internal/memory/procedural/store

Store procedural memory (learned skills, tool usage patterns).

#### Request

```json
{
  "id": "mem-pr-123",
  "name": "web_search",
  "content": "construct search query from user intent, call search API, summarize"
}
```

| Field   | Type   | Required | Description                      |
|---------+--------+----------+----------------------------------|
| id      | string | Yes      | Unique procedural memory id      |
| name    | string | Yes      | Procedural skill name            |
| content | string | Yes      | Instructions / procedure text    |
| metadata| object | No       | Optional metadata                |

#### Response (201)

```json
{
  "id": "mem_pr_789",
  "status": "recorded"
}
```

---

### 6. POST /api/v1/internal/memory/procedural/get

Retrieve procedural instructions by ID or name.

#### Request

```json
{
  "name": "web_search"
}
```

| Field | Type   | Required | Description                    |
|-------+--------+----------+--------------------------------|
| id    | string | No       | Procedural memory id           |
| name  | string | No       | Procedural skill name          |

At least one of `id` / `name` must be provided.

#### Response (200)

```json
{
  "id": "mem-pr-123",
  "name": "web_search",
  "content": "...",
  "metadata": {},
  "created_at": "2026-07-09T12:00:00Z",
  "updated_at": "2026-07-09T12:00:00Z"
}
```

Returns 404 (`{"error": "Procedural memory not found", "details": ""}`)
when no row matches.

### 7. POST /api/v1/internal/sessions/{id}/prune

Trigger manual session pruning — removes old messages beyond the threshold.

#### Request

```json
{
  "provider_config": {
    "type": "openai",
    "base_url": "https://api.openai.com/v1",
    "model": "gpt-4o"
  }
}
```

| Field           | Type   | Required | Description                              |
|-----------------+--------+----------+------------------------------------------|
| provider_config | object | Yes      | Provider configuration for summarization |

#### Response (200)

```json
{
  "status": "success",
  "message": "Session pruned and consolidated successfully"
}
```

> Note: the agent never calls this endpoint — session pruning is done
> in-process by the backend consolidation worker
> (`backend/internal/worker`). The route exists for operational/manual
> use.

---

### 8. GET /api/v1/internal/prompts/active

Fetch the active production prompt version for the agent's behavior
layer.

**Consumer**: the agent service. Called at system-prompt assembly time to
retrieve the current production prompt for a named template.

#### Request

Query parameters:

| Param    | Type   | Required | Description                                    |
|----------+--------+----------+------------------------------------------------|
| template | string | Yes      | Prompt template name (e.g. "customer_support_agent") |

Headers:

| Header        | Required | Description                                    |
|---------------+----------+------------------------------------------------|
| Authorization | Yes      | Bearer <service JWT> (HS256, `sub: "agent"`)   |
| X-Tenant-ID   | No       | Tenant scope; defaults to `"local"` when absent |

Example:

```bash
curl -X GET "http://localhost:8080/api/v1/internal/prompts/active?template=customer_support_agent" \
  -H "Authorization: Bearer <service-jwt>" \
  -H "X-Tenant-ID: local"
```

#### Response (200)

Returns the active version of the named template (`llmopsmodel.PromptVersion`):

```json
{
  "id": "pv-abc-123",
  "template_id": "tmpl-xyz-456",
  "version": 2,
  "system_prompt": "You are the customer support agent...",
  "bound_tools": ["web_search", "write_todos"],
  "variables": ["user_name"],
  "status": "production",
  "created_by": "sarah@echo.dev",
  "created_at": "2026-08-05T10:00:00Z"
}
```

| Field         | Type     | Description                                     |
|---------------+----------+-------------------------------------------------|
| id            | string   | Prompt version id                               |
| template_id   | string   | Owning prompt template id                       |
| version       | number   | Version number (1-based, monotonically increasing) |
| system_prompt | string   | Production system prompt text                   |
| bound_tools   | string[] | Tools the agent may invoke                      |
| variables     | string[] | Prompt variables to substitute                  |
| status        | string   | Version status ("production" once promoted)     |
| created_by    | string   | Actor who created the version                   |
| created_at    | string   | RFC 3339 UTC creation timestamp                 |

The backend resolves the version via `prompt_templates.active_version`
joined to `prompt_versions` for the given tenant + template name
(`backend/internal/repository/llmops/module/props/repository.go`).

#### Error Responses

| HTTP Status | Condition                                                      |
+-------------+----------------------------------------------------------------+
| 400         | Missing `template` query parameter                             |
| 401         | Missing/invalid/expired service JWT                            |
| 403         | Valid JWT but `sub` is not "agent"                             |
| 404         | No active production version for tenant + template name        |
| 500         | Unexpected server error                                        |
+-------------+----------------------------------------------------------------+

```json
// 400
{"error":"Query parameter 'template' is required","details":""}
// 404
{"error":"active prompt version not found: ...","details":""}
```

#### Caching & Invalidation

The agent caches the response in Redis under
`agent:prompts:<tenant>:<name>` (60s TTL, agent side). On promote or
rollback the backend best-effort deletes that key
(`backend/internal/service/llmops/prompt_service.go`), so the next
agent fetch observes the new production version immediately.

---

## Error Response Format (All Internal Endpoints)

All errors follow a consistent format (`backend/internal/handler/handlerutil/helpers.go`):

```json
{
  "error": "Human-readable description",
  "details": ""
}
```

| HTTP Status | Meaning                                  |
+-------------+------------------------------------------+
| 400         | Missing or invalid request body fields   |
| 401         | No/invalid/expired Authorization header or JWT |
| 403         | Valid JWT but `sub` is not "agent"       |
| 404         | Requested resource not found             |
| 500         | Unexpected server error                  |
+-------------+------------------------------------------+

## Example cURL

### Agent calling backend for episodic memory

```bash
# Agent signs a Service JWT (example for illustration)
JWT=$(echo '{"sub":"agent","iat":'$(date +%s)',"exp":'$(($(date +%s)+60))'}' | \
  openssl dgst -sha256 -hmac "your-service-jwt-secret" | \
  xxd -r -p | base64)

# The agent uses a proper JWT library in practice — this is a conceptual example.

curl -X POST http://localhost:8080/api/v1/internal/memory/episodic/store \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session-abc-123",
    "content": {
      "role": "assistant",
      "message": "The capital of France is Paris."
    },
    "metadata": {
      "session_id": "session-xyz-456"
    }
  }'
```

### Backend rejects invalid service JWT

```bash
curl -X POST http://localhost:8080/api/v1/internal/memory/episodic/store \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","content":{"role":"user","message":"hello"}}'

# Response: 401
# {"error":"Unauthorized: Invalid internal token","details":""}
```

A valid JWT whose `sub` is not `agent` is rejected with 403
(`{"error":"Forbidden: Invalid token subject","details":""}`).

## Rate Limits

Planned, not implemented — internal endpoints currently have no rate
limiting; all requests pass straight through to the handlers.
## Entry Points & Exports

- **Handler**: `backend/internal/handler/memory/handler.go`
- **Service**: `backend/internal/service/memory/service.go`
- **Handler (active prompt)**: `backend/internal/handler/llmops/agent_prompt_handler.go`
- **Service (active prompt)**: `backend/internal/service/llmops/prompt_service.go`
- **Middleware**: `backend/internal/middleware/internal_auth.go`

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
