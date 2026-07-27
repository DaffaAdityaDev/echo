================================================================================
  INTERNAL API CONTRACT
================================================================================
  Module    : Internal API Contract
  Service   : Shared / Contracts
  Version   : 1.0
  Updated   : 2026-07-09
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
    "message": "The capital of France is Paris.",
    "timestamp": "2026-07-09T12:00:00Z"
  },
  "metadata": {
    "mission_id": "mission-xyz-456",
    "type": "chat_turn"
  }
}
```

| Field           | Type   | Required | Description                    |
|-----------------+--------+----------+--------------------------------|
| session_id      | string | Yes      | Unique session identifier      |
| content         | object | Yes      | Episodic content payload       |
| content.role    | string | Yes      | "user" | "assistant" | "system" |
| content.message | string | Yes      | Message text                   |
| content.timestamp| string| Yes      | ISO 8601 timestamp             |
| metadata        | object | No       | Optional metadata              |

#### Response (201)

```json
{
  "success": true,
  "id": "mem-ep-789"
}
```

#### Error Response

```json
{
  "success": false,
  "error": "validation_error",
  "message": "session_id is required"
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
  "success": true,
  "episodes": [
    { "role": "assistant", "message": "The capital of France is Paris.", "timestamp": "2026-07-09T12:00:00Z" }
  ]
}
```

---

### 4. POST /api/v1/internal/memory/semantic/search

Search semantic memories by query.

#### Request

```json
{
  "session_id": "session-abc-123",
  "query": "capital of France",
  "limit": 10
}
```

| Field      | Type   | Required | Description                    |
|------------+--------+----------+--------------------------------|
| session_id | string | Yes      | Unique session identifier      |
| query      | string | Yes      | Search query text              |
| limit      | number | No       | Max results (default 10)       |

#### Response (200)

```json
{
  "success": true,
  "results": [
    { "fact": "The capital of France is Paris.", "confidence": 0.95, "source": "conversation" }
  ]
}
```

---

### 5. POST /api/v1/internal/memory/procedural/store

Store procedural memory (learned skills, tool usage patterns).

#### Request

```json
{
  "session_id": "session-abc-123",
  "skill": "web_search",
  "steps": [
    "construct search query from user intent",
    "call search API with query",
    "parse and summarize results"
  ],
  "outcome": "success",
  "metadata": {
    "mission_id": "mission-xyz-456"
  }
}
```

| Field      | Type     | Required | Description                    |
|------------+----------+----------+--------------------------------|
| session_id | string   | Yes      | Unique session identifier      |
| skill      | string   | Yes      | Skill identifier               |
| steps      | string[] | Yes      | Ordered steps taken            |
| outcome    | string   | Yes      | "success" | "failure"          |
| metadata   | object   | No       | Optional metadata              |

#### Response (201)

```json
{
  "success": true,
  "id": "mem-pr-789"
}
```

---

### 6. POST /api/v1/internal/memory/procedural/get

Retrieve procedural instructions by name.

#### Request

```json
{
  "name": "web_search"
}
```

| Field | Type   | Required | Description                    |
|-------+--------+----------+--------------------------------|
| name  | string | Yes      | Procedural skill name          |

#### Response (200)

```json
{
  "success": true,
  "procedure": {
    "name": "web_search",
    "content": "...",
    "metadata": {}
  }
}
```

### 7. POST /api/v1/internal/sessions/:id/prune

Trigger manual session pruning — removes old messages beyond the threshold.

#### Request

```json
{
  "threshold": 100000,
  "keep_latest_turns": 10
}
```

| Field             | Type   | Required | Description                         |
|-------------------+--------+----------+-------------------------------------|
| threshold         | number | No       | Token threshold (default from config)|
| keep_latest_turns | number | No       | Turns to retain (default from config)|

#### Response (200)

```json
{
  "success": true,
  "session_id": "session-abc-123",
  "pruned_count": 25
}
```

---

## Error Response Format (All Internal Endpoints)

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "error_code",
  "message": "Human-readable description"
}
```

| HTTP Status | error_code              | Meaning                                  |
+-------------+-------------------------+------------------------------------------+
| 400         | validation_error        | Missing or invalid request body fields   |
| 401         | missing_token           | No Authorization header provided         |
| 401         | invalid_token           | JWT parse failure or wrong secret        |
| 401         | token_expired           | JWT exp claim is in the past             |
| 403         | invalid_subject         | sub claim is not "agent"                 |
| 500         | internal_error          | Unexpected server error                  |
+-------------+-------------------------+------------------------------------------+

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
      "message": "The capital of France is Paris.",
      "timestamp": "2026-07-09T12:00:00Z"
    },
    "metadata": {
      "mission_id": "mission-xyz-456"
    }
  }'
```

### Backend rejects invalid service JWT

```bash
curl -X POST http://localhost:8080/api/v1/internal/memory/episodic/store \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"test","content":{"role":"user","message":"hello","timestamp":"2026-01-01T00:00:00Z"}}'

# Response: 401
# {"success":false,"error":"invalid_token","message":"Invalid service token"}
```

## Rate Limits

Internal endpoints share a pool:

+---------------------------+-----------+--------+-----------+
| Endpoint Group            | Limit     | Window | Scope     |
+---------------------------+-----------+--------+-----------+
| All /api/v1/internal/*    | 200 req/  | 1 min  | Per agent |
|                           | min       |        | instance  |
+---------------------------+-----------+--------+-----------+

## Entry Points & Exports

- **Handler**: `backend/internal/handler/memory/handler.go`
- **Service**: `backend/internal/service/memory/service.go`
- **Middleware**: `backend/internal/middleware/internal_auth.go`

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
