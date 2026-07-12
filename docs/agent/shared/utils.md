================================================================================
  Utils - Shared Utility Classes and Functions
================================================================================
  Module    : Utilities
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

The shared utils layer provides the foundation for logging, error handling,
message serialization, harness analysis, and a provider-agnostic reasoning token
interceptor. These utilities are used across the infrastructure, domain, and
application layers.

---

## File Structure

```
src/shared/utils/
  logger.ts             # Logger class (console + file + langfuse)
  errors.ts             # AppError hierarchy
  messages.ts           # LangChain message reconstruction

src/infrastructure/providers/utils/
  index.ts              # calculateUsageCost
  reasoning-interceptor.ts  # ReasoningInterceptor (SSE reasoning capture)
  zod-schema.ts         # zodV4ToOpenAISchema (Zod → OpenAI JSON Schema)

src/utils/
  harness.ts            # Cosine similarity, token counting, truncation, validation
```

---

## Logger (shared/utils/logger.ts)

A singleton `Logger` class with five output levels and three output targets:

+------------------------+----------------+----------------+------------------+---------------------------------------+
| Method                 | Console Color  | File Output    | Langfuse         | Use Case                              |
+------------------------+----------------+----------------+------------------+---------------------------------------+
| `logger.info()`        | Cyan           | logs/{date}.log | —               | General operational messages          |
| `logger.warn()`        | Yellow         | logs/{date}.log | —               | Non-critical issues                   |
| `logger.error()`       | Red (bold)     | logs/{date}.log | —               | Critical failures                     |
| `logger.debug()`       | Gray           | logs/{date}.log | —               | Development diagnostics               |
| `logger.langfuse()`    | Per level      | logs/{date}.log | Writes to span  | Langfuse-synced logging               |
| `logger.telemetry()`   | Magenta        | logs/{date}.log | —               | LLM call metrics with cost            |
| `logger.agentActivity()`| Magenta bold | logs/{date}.log | —              | Agent execution events                |
|                       |                | + agent-activity.log|                |                                       |
+------------------------+----------------+----------------+------------------+---------------------------------------+

### Log File Format

```
logs/
  {date}.log              # All log levels
  agent-activity.log      # Agent-specific activity events
```

The `langfuse()` method dynamically imports `langfuseStorage` to write events
to the active OTel observation.

---

## Error Classes (shared/utils/errors.ts)

```typescript
class AppError extends Error {
  constructor(public message: string, public statusCode = 500, public isOperational = true)
}

class ValidationError extends AppError {    // statusCode: 400 }
class NotFoundError extends AppError {      // statusCode: 404 }
class ForbiddenError extends AppError {     // statusCode: 403 }
```

Used by the `errorHandler` middleware (checks `err instanceof AppError`) and can
be thrown in application code for structured error responses.

---

## Message Utils (shared/utils/messages.ts)

```typescript
function mapHistoryToMessages(
  history?: Array<{ role: string; content: string }>
): BaseMessage[]
```

Converts raw API message history (from the `POST /api/generate-mission` body)
into LangChain `HumanMessage` and `AIMessage` objects. Used in
`MissionController.createMission()`.

---

## Harness Utils (utils/harness.ts)

+----------------------------------+---------------------------------------------------------------+
| Function                         | Description                                                   |
+----------------------------------+---------------------------------------------------------------+
| `getCosineSimilarity(text1,text2)`| Bag-of-words cosine similarity for text comparison            |
| `getHistoryTokens(msgs)`          | Estimates token count from message history (char/4)           |
| `selectiveTruncateToolResults()`  | Truncates tool result messages exceeding threshold            |
| `validateContent(filename,content)`| Validates file content: placeholders, JSON, TS syntax        |
+----------------------------------+---------------------------------------------------------------+

---

## Reasoning Interceptor (infrastructure/providers/utils/reasoning-interceptor.ts)

A provider-agnostic utility that captures **thinking/reasoning tokens** from raw
SSE streams by intercepting the `fetch` response body.

### Flow Diagram - Reasoning Token Capture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      LLM Provider API Response                            │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│            ReasoningInterceptor.interceptFetch(url, options)              │
│                                                                           │
│  Check: url contains '/chat/completions' or '/messages'                   │
│                                                                           │
│  response.body.tee()                                                      │
│                                                                           │
│  ┌─ stream1 → processReasoningStream()  (background)                     │
│  │              Parse SSE "data:" lines                                   │
│  │              Extract reasoning fields:                                 │
│  │                OpenAI/LM Studio: delta.reasoning_content               │
│  │                Anthropic:       delta.type === "thinking_delta"        │
│  │              Store by messageId in Map<id, string>                    │
│  │                                                                        │
│  └─ stream2 → new Response()  (returned to caller)                      │
└──────────────────────────────────────────────────────────────────────────┘
```

+-----------------------------------+---------------------------------------------------+
| Method                            | Description                                       |
+-----------------------------------+---------------------------------------------------+
| `interceptFetch(url, options)`    | Tees the response body, starts background parsing |
| `processReasoningStream(stream)`  | Parses SSE chunks, extracts reasoning by message  |
| `getDelta(messageId, sentMap)`    | Returns newly appended reasoning since last call  |
| `getReasoningTokenCount(msgId)`   | Estimates token count (word count)               |
| `cleanup(sentIds)`                | Awaits active stream, deletes stored reasoning    |
| `clearAll()`                      | Awaits active stream, clears all stored reasoning |
+-----------------------------------+---------------------------------------------------+

---

## Zod-to-OpenAI Schema Converter (infrastructure/providers/utils/zod-schema.ts)

```typescript
function zodV4ToOpenAISchema(schema: z.ZodType<any>): Record<string, any>
```

Recursively converts Zod v4 schemas to OpenAI-compatible JSON Schema (function-calling format).

+----------------+---------------------------------------------+
| Zod Type       | OpenAI Type                                 |
+----------------+---------------------------------------------+
| `ZodString`    | `{ type: "string" }`                       |
| `ZodNumber`    | `{ type: "number" }`                       |
| `ZodBoolean`   | `{ type: "boolean" }`                      |
| `ZodEnum`      | `{ type: "string", enum: [...] }`          |
| `ZodArray`     | `{ type: "array", items: ... }`           |
| `ZodObject`    | `{ type: "object", properties: ... }`     |
| `ZodOptional`/`ZodDefault`| Unwraps to inner type            |
| Unhandled      | Fallback to `{ type: "string" }` + warning |
+----------------+---------------------------------------------+

Used exclusively by `OpenCodeGoProvider` to serialize tool schemas for the OpenAI SDK.

---

## Usage Cost Calculator (infrastructure/providers/utils/index.ts)

```typescript
function calculateUsageCost(
  modelName: string,
  baseURL: string,
  promptTokens: number,
  completionTokens: number,
  cachedTokens: number
): { stepCost: number; cacheRatio: number }
```

- Detects local models via `LOCAL_URL_KEYWORDS` → returns `{ stepCost: 0, ... }`
- Matches model name against `PRICING_MODELS` patterns
- Calculates cost per million tokens with cache discount:
  `((nonCached * inputRate) + (cachedTokens * cacheReadRate) + (completionTokens * outputRate)) / 1_000_000`

---

## Dependencies

+----------------------------------+--------------------------------------------------------------+
| Dependency                       | Usage                                                        |
+----------------------------------+--------------------------------------------------------------+
| `@langchain/core/messages`       | BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMsg |
| `typescript`                     | `ts.createSourceFile` for TS syntax validation              |
| `zod`                            | Schema input for zodV4ToOpenAISchema                        |
| `openai`                         | Referenced via the schema converter                         |
| `node:fs`                        | Log file writing                                             |
| `node:path`                      | Log file path resolution                                     |
+----------------------------------+--------------------------------------------------------------+

---

## Source References

+--------------------------------------------------+-----------------------------+---------------------------------------------------+
| File                                             | Line                        | Description                                       |
+--------------------------------------------------+-----------------------------+---------------------------------------------------+
| `shared/utils/logger.ts`                         | 92-165                      | Logger class: info, warn, error, debug, langfuse  |
| `shared/utils/logger.ts`                         | 72-90                       | File-based logging with date-rotated files        |
| `shared/utils/errors.ts`                        | 1-43                        | AppError, ValidationError, NotFoundError, Forbidden|
| `shared/utils/messages.ts`                      | 1-15                        | mapHistoryToMessages                              |
| `utils/harness.ts`                              | 4-39                        | getCosineSimilarity                               |
| `utils/harness.ts`                              | 41-43                       | getHistoryTokens                                  |
| `utils/harness.ts`                              | 45-66                       | selectiveTruncateToolResults                      |
| `utils/harness.ts`                              | 68-114                      | validateContent                                   |
| `providers/utils/reasoning-interceptor.ts`      | 5-148                       | Full ReasoningInterceptor implementation          |
| `providers/utils/reasoning-interceptor.ts`      | 12-25                       | interceptFetch — body tee                         |
| `providers/utils/reasoning-interceptor.ts`      | 30-88                       | processReasoningStream — SSE parsing              |
| `providers/utils/zod-schema.ts`                 | 4-91                        | zodV4ToOpenAISchema                               |
| `providers/utils/index.ts`                      | 5-42                        | calculateUsageCost                                |
+--------------------------------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
