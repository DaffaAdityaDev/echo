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

### 1. POST /api/v1/internal/memory/episodic

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

### 2. POST /api/v1/internal/memory/semantic

Store semantic memory (facts, knowledge extracted from context).

#### Request

```json
{
  "session_id": "session-abc-123",
  "fact": "The capital of France is Paris.",
  "source": "conversation",
  "confidence": 0.95,
  "tags": ["geography", "capital", "france"],
  "metadata": {
    "mission_id": "mission-xyz-456"
  }
}
```

| Field      | Type    | Required | Description                    |
|------------+---------+----------+--------------------------------|
| session_id | string  | Yes      | Unique session identifier      |
| fact       | string  | Yes      | Extracted fact / knowledge     |
| source     | string  | Yes      | Origin of the fact             |
| confidence | number  | Yes      | Confidence score (0.0 - 1.0)  |
| tags       | string[]| No       | Categorization tags            |
| metadata   | object  | No       | Optional metadata              |

#### Response (201)

```json
{
  "success": true,
  "id": "mem-sm-456"
}
```

---

### 3. POST /api/v1/internal/memory/procedural

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

### 4. POST /api/v1/internal/state/:key

Set or get agent state for a given key.

#### Set State

```json
{
  "session_id": "session-abc-123",
  "value": { "current_step": 3, "subtask": "research" }
}
```

| Field      | Type   | Required | Description                    |
|------------+--------+----------+--------------------------------|
| session_id | string | Yes      | Unique session identifier      |
| value      | any    | Yes      | Arbitrary JSON value to store  |

#### Response (200)

```json
{
  "success": true,
  "key": "current_task",
  "session_id": "session-abc-123"
}
```

---

### 5. POST /api/v1/internal/config/session

Update session configuration (model, features, mode overrides).

#### Request

```json
{
  "session_id": "session-abc-123",
  "config": {
    "model": "gpt-4o",
    "features": ["web_search", "code_execute"],
    "mode": "standard",
    "ttl_seconds": 3600
  }
}
```

| Field         | Type    | Required | Description                     |
|---------------+---------+----------+---------------------------------|
| session_id    | string  | Yes      | Unique session identifier       |
| config        | object  | Yes      | Configuration payload           |
| config.model  | string  | No       | Model override                  |
| config.features| string[]| No      | Feature set override            |
| config.mode   | string  | No       | "standard" | "agent"  |
| config.ttl_seconds| number| No     | Session TTL in seconds          |

#### Response (200)

```json
{
  "success": true,
  "session_id": "session-abc-123"
}
```

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
| 404         | not_found               | Resource not found (e.g. state key)      |
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

curl -X POST http://localhost:8080/api/v1/internal/memory/episodic \
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
curl -X POST http://localhost:8080/api/v1/internal/memory/episodic \
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

- **Handler**: `backend/internal/handler/memory_handler.go`
- **Service**: `backend/internal/service/memory_service.go`
- **Middleware**: `backend/internal/middleware/internal_auth.go`

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
