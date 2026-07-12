================================================================================
  ERROR HANDLING
================================================================================
  Module    : Error Handling
  Service   : Shared / Patterns
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Cross-service error taxonomy and consistent JSON error response format. Covers
Go Fiber error responses, Hono agent error types, frontend error handling, and
the shared error contract.

## File Structure

+------------------------------------+--------------------------------------------+
| Location                           | Role                                       |
+------------------------------------+--------------------------------------------+
| backend/internal/handler/          |                                            |
|   auth_handler.go                  | 501, 500 errors                           |
|   chat_handler.go                  | 400, 403, 500 errors                      |
| backend/internal/middleware/       |                                            |
|   auth.go                          | 401 errors                                 |
| backend/internal/constants/       |                                            |
|   auth/jwt.go                      | Error messages                             |
|   db/postgres.go                   | DB error messages                          |
| agent/src/shared/constants/        |                                            |
|   errors.ts                        | Error type taxonomy + messages             |
|   middleware.ts                    | Forbidden message                          |
| agent/src/app/middleware/auth.ts   | 403 response shape                         |
| agent/src/app/api/missions/        |                                            |
|   mission.controller.ts            | Validation + execution errors              |
| frontend/web/src/lib/              |                                            |
|   api-client.ts                    | Standard request error                     |
| frontend/web/src/features/chat/   |                                            |
|   api/useChatStream.ts             | Stream error handler                       |
+------------------------------------+--------------------------------------------+

## Error Response Format (Cross-Service)

### Unified Shape

```json
{
  "error": "Human-readable error message",
  "details": "Optional technical details, stack trace, or validation formatting"
}
```

### Source-Specific Shapes

**Go Gateway Errors:**
```json
{"error": "Invalid request"}
{"error": "Unknown model 'gpt-5'"}
{"error": "Feature 'Web Search' requires a Pro subscription."}
{"error": "Agent service unreachable"}
```

**Agent Validation Errors:**
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

**Agent Auth Errors:**
```json
{
  "status": "error",
  "message": "Forbidden: Invalid or missing internal token authentication credentials."
}
```

## Error Taxonomy

### Go Backend Errors

+------------------+-----------+---------+------------------------------------------+
| Error Constant   | Type      | HTTP    | Message                                  |
|                  |           | Code    |                                          |
+------------------+-----------+---------+------------------------------------------+
| ErrMissingToken  | Auth      | 401     | "Unauthorized: Missing token"            |
| ErrInvalidToken  | Auth      | 401     | "Unauthorized: Invalid token"            |
| ErrCreateUser    | Database  | 500     | "failed to create user"                  |
| ErrGetUserEmail  | Database  | 500     | "failed to get user by email"            |
| ErrPostgresConfig| Database  | 500     | "unable to parse database config"        |
| ErrPostgresPool  | Database  | 500     | "unable to create connection pool"       |
| ErrPostgresPing  | Database  | 500     | "unable to ping database"                |
+------------------+-----------+---------+------------------------------------------+

### Agent Error Types

```typescript
ERROR_TYPES = {
  APPLICATION_ERROR: "APPLICATION_ERROR",
  RATE_LIMIT: "RATE_LIMIT_ERROR",
  TIMEOUT: "TIMEOUT_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL_SERVER: "INTERNAL_SERVER_ERROR",
}

ERROR_MESSAGES = {
  RATE_LIMIT: "Upstream LLM Provider API rate limit exceeded. Please retry shortly.",
  TIMEOUT: "Upstream LLM Provider query timed out. Please retry.",
  BAD_REQUEST: "Malformed request payload body. Ensure valid JSON structure is supplied.",
  INTERNAL_SERVER: "Internal server error",
}
```

### Frontend Error Handling

```typescript
// api-client.ts — Standard request error
if (!response.ok) {
  const error = await response.json().catch(() => ({ message: "An unexpected error occurred" }));
  throw new Error(error.message || response.statusText);
}

// useChatStream.ts — SSE streaming error
catch (err) {
  setMessages((prev) => {
    const lastMessage = {
      ...prev[lastIdx],
      content: `Error: ${err.message || "Failed to fetch response from agent."}`
    };
    return [...prev.slice(0, -1), lastMessage];
  });
}
```

## Error Flow Diagrams

### Go Gateway Error Flow

```
Client Request
     │
     ▼
AuthRequired() middleware
     │
     ├── No token -> 401 {"error": "Unauthorized: Missing token"}
     │
     ├── Invalid token -> 401 {"error": "Unauthorized: Invalid token"}
     │
     ▼
HandleChat()
     │
     ├── Invalid JSON body -> 400 {"error": "Invalid request"}
     │
     ├── Unknown model -> 400 {"error": "Unknown model '{id}'"}
     │
     ├── Free user + Pro feature -> 403 {"error": "Feature 'X' requires Pro"}
     │
     ├── Agent connection failed -> 500 {"error": "Agent service unreachable"}
     │
     ├── Agent returned non-200 -> 500 {"error": "Agent request failed",
     │                                        "details": "..."}
     │
     ▼
SSE Stream (on success)
```

### Agent Error Flow

```
Agent Request
     │
     ▼
authMiddleware()
     │
     ├── Invalid/missing internal token -> 403 { status: "error",
     │      message: "Forbidden..." }
     │
     ▼
createMission()
     │
     ├── Zod safeParse fails -> 400 { error: "Validation failed",
     │                                  details: {...} }
     │
     ├── Execution error -> 500 { error: "Execution failed",
     │                              details: error.message }
     │
     ▼
SSE Stream (via harness)
     │
     ├── AgentPacket with type: "error" -> streamed in-band
```

## Error Status Code Summary

+------+------------------------------------------------------+-----------+
| Code | When                                                 | Service   |
+------+------------------------------------------------------+-----------+
| 400  | Invalid request body, unknown model, validation      | Go, Agent |
|      |   failure                                            |           |
| 401  | Missing or invalid JWT token                         | Go        |
| 403  | Pro feature for free user, bad internal token        | Go, Agent |
| 404  | Resource not found (planned)                         | Go        |
| 500  | Internal failures, agent unreachable, token          | Go, Agent |
|      |   generation failure                                 |           |
| 501  | Not implemented (register)                           | Go        |
+------+------------------------------------------------------+-----------+

## In-Stream Error Events

For errors during agent execution (not request validation), the agent emits an
SSE packet:

```typescript
{ "type": "error", "content": "Tool execution failed: connection refused", "step": 5, ... }
```

The frontend processes these like any other stream packet — they appear as
thought steps.

## Entry Points & Exports

- **Go error constants**: `backend/internal/constants/auth/jwt.go` —
  `ErrMissingToken`, `ErrInvalidToken`
- **Go DB error constants**: `backend/internal/constants/db/postgres.go` —
  `ErrCreateUser`, `ErrGetUserEmail`, `ErrPostgres*`
- **Agent error types**: `agent/src/shared/constants/errors.ts` — `ERROR_TYPES`,
  `ERROR_MESSAGES`
- **Agent auth error**: `agent/src/shared/constants/middleware.ts` —
  `FORBIDDEN_MESSAGE`
- **Frontend error handler**: `frontend/web/src/lib/api-client.ts:42-44`
- **Frontend stream error**: `frontend/web/src/features/chat/api/
  useChatStream.ts:235-246`

## Source References

+-------------------------------------------------------+-------+---------------------------------------+
| File                                                  | Lines | Role                                  |
+-------------------------------------------------------+-------+---------------------------------------+
| backend/internal/constants/auth/jwt.go                | 10-12 | Auth error messages                   |
| backend/internal/constants/db/postgres.go             | 3-26  | DB error messages                     |
| backend/internal/handler/chat_handler.go              | 94-96,| Go error responses                    |
|                                                       | 143-  |                                       |
|                                                       | 148,  |                                       |
|                                                       | 184-  |                                       |
|                                                       | 185,  |                                       |
|                                                       | 196-  |                                       |
|                                                       | 197,  |                                       |
|                                                       | 201-  |                                       |
|                                                       | 203   |                                       |
| agent/src/shared/constants/errors.ts                  | 1-14  | Error type taxonomy + messages        |
| agent/src/shared/constants/middleware.ts              | 8     | Forbidden message                     |
| agent/src/app/middleware/auth.ts                      | 25-28 | 403 response shape                    |
| agent/src/app/api/missions/mission.controller.ts      | 28-33,| Validation + execution errors         |
|                                                       | 117-  |                                       |
|                                                       | 119   |                                       |
| frontend/web/src/lib/api-client.ts                    | 42-44 | Standard request error                |
| frontend/web/src/features/chat/api/useChatStream.ts   | 235-  | Stream error handler                  |
|                                                       | 246   |                                       |
+-------------------------------------------------------+-------+---------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
