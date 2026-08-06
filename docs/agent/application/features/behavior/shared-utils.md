================================================================================
  Shared Utilities - Cross-Cutting Shared Layer
================================================================================
  Module    : Shared Utilities
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Cross-cutting shared layer providing types, constants, error classes, structured
logging, message helpers, and middleware for authentication, error handling, and
request monitoring.

---

## File Structure

```
shared/
  types/
    index.ts             # Core interfaces: LLMProvider, AgentStrategy,
                         # AgentState, ToolDefinition, ProviderEvent
  constants/
    index.ts             # LLM_API_VERSIONS, LLM_CONFIG
    errors.ts            # ERROR_TYPES, ERROR_STATUS, ERROR_MESSAGES
    http.ts              # HTTP_STATUS code map
    middleware.ts        # AUTH_CONSTANTS, MONITOR_CONSTANTS
  utils/
    errors.ts            # AppError, ValidationError, NotFoundError, ForbiddenError
    logger.ts            # Structured Logger with file + console output
    messages.ts          # mapHistoryToMessages
    harness.ts           # Cosine similarity, token counting, validateContent
    jwt.ts               # Service JWT signing/verification
    langfuse.ts          # Langfuse trace helpers
    telemetry.ts         # OTel telemetry helpers
    http.ts              # HTTP request wrapper

adapter/inbound/middleware/
  auth.ts                # Token-based authentication guard
  error.ts               # Global error handler
  monitor.ts             # Request/response monitoring middleware
```

---

## Middleware Pipeline

```
    ┌─────────────────────────────────────────────────────────────────┐
    │                         Request                                  │
    └────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │  monitorMiddleware                                               │
    │  - Logs method, path, traceparent, payload summary              │
    │  - Clones body for diagnostics (strips history)                 │
    │  - Measures duration → logs response status + timing            │
    └────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │  authMiddleware                                                  │
    │  - Bypass for "/", "/api/docs", and "/docs"                      │
    │  - Check Authorization: Bearer <token>                          │
    │  - Check X-Internal-Token header                                │
    │  - Compare against ENV.INTERNAL_AUTH_TOKEN                      │
    │  - 403 on mismatch                                              │
    └────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │  Router → Controller                                             │
    └────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │  errorHandler (catches thrown errors)                            │
    │  1. AppError           → statusCode + error_type                │
    │  2. Rate limit (429)   → RATE_LIMIT_ERROR                      │
    │  3. Timeout (504)      → TIMEOUT_ERROR                         │
    │  4. JSON SyntaxError   → BAD_REQUEST (400)                     │
    │  5. Default            → INTERNAL_SERVER_ERROR (500)            │
    └────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                         Response                                 │
    └─────────────────────────────────────────────────────────────────┘
```

### Error Class Hierarchy

```
    Error
      │
    AppError (message, statusCode, isOperational)
      │
    ├── ValidationError (400)
    ├── NotFoundError (404)
    └── ForbiddenError (403)
```

---

## Logger Levels & Methods

+------------------------+------------------+----------------+---------------------------------------+
| Method                 | Console Color    | File Level     | Use Case                              |
+------------------------+------------------+----------------+---------------------------------------+
| `logger.info()`        | Cyan             | INFO           | General operational messages          |
| `logger.warn()`        | Yellow           | WARN           | Non-critical issues                   |
| `logger.error()`       | Red (bold)       | ERROR          | Critical failures                     |
| `logger.debug()`       | Gray             | DEBUG          | Development diagnostics               |
| `logger.langfuse()`    | Per level        | Per level      | Langfuse-synced logging               |
| `logger.telemetry()`   | Magenta          | TELEMETRY      | LLM call metrics with cost            |
| `logger.agentActivity()`| Magenta bold    | AGENT_<EVENT>  | Agent execution events                |
+------------------------+------------------+----------------+---------------------------------------+

---

## Entry Points & Exports

+----------------------------+--------------------------------------+----------------------------------------------+
| Export                     | Source                               | Type                                         |
+----------------------------+--------------------------------------+----------------------------------------------+
| `LLMProvider`              | `shared/types/index.ts`              | Provider interface                           |
| `AgentStrategy`            | `shared/types/index.ts`              | Strategy interface                           |
| `AgentState`               | `shared/types/index.ts`              | State interface                              |
| `ToolDefinition`           | `shared/types/index.ts`              | Tool definition interface                    |
| `ProviderEvent`            | `shared/types/index.ts`              | Stream event union                           |
| `HarnessPacket`            | `shared/types/index.ts`              | Packet structure                             |
| `Observation`              | `shared/types/index.ts`              | Tool result type                             |
| `MissionPayload`           | `shared/types/index.ts`              | Mission input                                |
| `AgentPacketType`          | `shared/types/index.ts`              | Packet type union                            |
| `LLM_API_VERSIONS`         | `shared/constants/index.ts`          | API version strings                          |
| `ERROR_TYPES`              | `shared/constants/errors.ts`         | Error category labels                        |
| `ERROR_MESSAGES`           | `shared/constants/errors.ts`         | User-facing error strings                    |
| `AUTH_CONSTANTS`           | `shared/constants/middleware.ts`     | Auth header config                           |
| `MONITOR_CONSTANTS`        | `shared/constants/middleware.ts`     | Monitoring config                            |
| `AppError`                 | `shared/utils/errors.ts`             | Base application error                       |
| `ValidationError`          | `shared/utils/errors.ts`             | 400 error                                    |
| `NotFoundError`            | `shared/utils/errors.ts`             | 404 error                                    |
| `ForbiddenError`           | `shared/utils/errors.ts`             | 403 error                                    |
| `logger`                   | `shared/utils/logger.ts`             | Logger singleton                             |
| `mapHistoryToMessages`     | `shared/utils/messages.ts`           | API history → LangChain messages             |
| `authMiddleware`           | `adapter/inbound/middleware/auth.ts`              | Hono middleware                              |
| `errorHandler`             | `adapter/inbound/middleware/error.ts`             | Hono error handler                           |
| `monitorMiddleware`        | `adapter/inbound/middleware/monitor.ts`           | Hono middleware                              |
+----------------------------+--------------------------------------+----------------------------------------------+

---

## Dependencies

+----------------------------------+--------------------------------------------------------------+
| Dependency                       | Purpose                                                      |
+----------------------------------+--------------------------------------------------------------+
| `@langchain/core/messages`       | BaseMessage, HumanMessage, AIMessage, SystemMessage          |
| `zod`                            | Schema type for ToolDefinition                               |
| `node:fs`                        | Log file writing                                             |
| `node:path`                      | Log file path resolution                                     |
+----------------------------------+--------------------------------------------------------------+

---

## Source References

+--------------------------+------------------------------------------+-------------------------------------------------------+
| Ref                      | File                                     | Key Lines                                             |
+--------------------------+------------------------------------------+-------------------------------------------------------+
| LLMProvider              | `shared/types/index.ts:310-323`      | Stream, cleanupReasoning, validate, multimodal |
| ProviderEvent            | `shared/types/index.ts:287-304`      | Content, reasoning, toolCall, usage variants  |
| AgentStrategy            | `shared/types/index.ts:248-251`      | `name` + `buildSystemPrompt()`                |
| ToolDefinition           | `shared/types/index.ts:275-281`      | `name`, `description`, `schema`, `execute`, `keywords`|
| ERROR_TYPES              | `shared/constants/errors.ts:1-7`     | Error category labels                         |
| ERROR_MESSAGES           | `shared/constants/errors.ts:11-16`   | User-facing messages                          |
| AUTH_CONSTANTS           | `shared/constants/middleware.ts:1-9` | Header names, bearer prefix, bypass path      |
| MONITOR_CONSTANTS        | `shared/constants/middleware.ts:11-20`   | Request ID header, traceparent            |
| AppError                 | `shared/utils/errors.ts:4-16`           | Base error with statusCode + isOperational |
| Logger                   | `shared/utils/logger.ts:92-165`         | info, warn, error, debug, langfuse, telemetry |
| mapHistoryToMessages     | `shared/utils/messages.ts:6-41`         | Maps user/system/tool roles to LangChain messages |
| Auth middleware           | `adapter/inbound/middleware/auth.ts:8-42`           | Bearer/X-Internal-Token check against ENV.INTERNAL_AUTH_TOKEN; bypasses "/", "/api/docs", "/docs" |
| Error handler            | `adapter/inbound/middleware/error.ts:8-73`          | Pattern-matched error categories                      |
| Monitor middleware       | `adapter/inbound/middleware/monitor.ts:5-54`        | Request/response logging with timing                  |
+--------------------------+------------------------------------------+-------------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
