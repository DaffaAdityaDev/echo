===============================================================================
  ACID, SOLID & CLEAN CODE
===============================================================================
  Module    : ACID/SOLID/Clean Code
  Service   : Shared / Patterns
  Version   : 1.0
  Updated   : 2026-07-23
===============================================================================

## Description

Mandatory engineering standards for all Echo code. Every agent implementing
changes MUST follow these rules. Violations produce unreviewable code.

## ACID — Database Transactions

All multi-query sequences MUST be wrapped in a DB transaction. A single
`UPDATE` or `INSERT` is fine on its own; two or more that must succeed or
fail together are not.

### Go — pgx Transaction Pattern

```go
tx, err := pool.Begin(ctx)
if err != nil { return fmt.Errorf("tx begin: %w", err) }
defer tx.Rollback(ctx) // no-op if committed

_, err = tx.Exec(ctx, query1, args...)
if err != nil { return fmt.Errorf("step 1: %w", err) }

_, err = tx.Exec(ctx, query2, args...)
if err != nil { return fmt.Errorf("step 2: %w", err) }

return tx.Commit(ctx)
```

### Known Multi-Query Sequences That Need Transactions

| File | Sequence | ACID? |
|---|---|---|
| `chat_handler.go` — final flush | `UpdateMessageContent` + `UpdateMessageStatus` + `UpdateSessionTimestamp` | ❌ Must be 1 tx |
| `chat_handler.go` — user msg + placeholder | `InsertMessage("user")` + `InsertAssistantPlaceholder` | ❌ Must be 1 tx |
| `session_handler.go` — prune | `UpdateContextSummary` + `DeleteMessagesUpToTurn` + `UpdateSessionTimestamp` | ❌ Must be 1 tx |
| `session_repository.go` — SaveTurnMessages | All 4 steps | ✅ Already in tx |

### Context Timeout

Every DB call must have a timeout:

```go
ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
// use ctx for all DB calls in this scope
```

Use `context.Background()` (not request `ctx`) when the write must outlive
the HTTP request lifecycle (e.g., final flush after stream ends).

### Flush Goroutine Retry

The 2-second flush goroutine MUST retry at least once on failure before
logging and moving on:

```go
for attempt := 0; attempt < 2; attempt++ {
    err := doFlush(ctx, ...)
    if err == nil { break }
    if attempt == 0 { time.Sleep(100 * time.Millisecond) }
}
```

---

## Isolation — Session-Level Mutex

Multiple concurrent requests to the same session cause data races (overlapping
turn_number, interleaved messages). The `HandleChat` handler MUST acquire a
per-session lock before processing:

```go
var sessionMu sync.Map // map[sessionID]chan struct{}

func acquireSessionLock(sessionID string) func() {
    ch := make(chan struct{}, 1)
    actual, loaded := sessionMu.LoadOrStore(sessionID, ch)
    if loaded {
        actual.(chan struct{}) <- struct{}{} // wait
    }
    return func() { <-ch } // release
}
```

Usage:

```go
release := acquireSessionLock(req.SessionID)
defer release()
// ... all session read/write logic ...
```

---

## Consistency — DB Constraints

Use PostgreSQL CHECK constraints to enforce data shape at the database level.
Never rely solely on application-level validation.

```sql
CHECK (status IN ('streaming', 'complete', 'interrupted'))
CHECK (role IN ('user', 'assistant', 'system', 'tool_result', 'thought', 'tool_call'))
CHECK (status IN ('active', 'archived', 'deleted'))
```

---

## Durability — Write Confirmation

Every write that must survive must use `Sync` or equivalent. For PostgreSQL
this is automatic. For Redis ephemeral state, set an explicit TTL:

```go
rdb.Set(ctx, key, value, 10*time.Minute)
```

---

## SOLID — Go Backend

### Single Responsibility

One handler method = one operation. Do NOT mix business logic with HTTP
serialization.

```
Handler  → parse request, validate, call service, format response
Service  → business logic, orchestration
Repo     → data access, SQL queries
```

### Open/Closed

Add behaviour via new types/strategies, not by modifying existing ones.
The `ModelService` resolves providers via a map — add a new entry, do not
edit the resolution logic.

### Liskov Substitution

Interfaces must be substitutable. If a function accepts `io.Reader`, any
implementation must work without the function knowing the concrete type.

### Interface Segregation

Keep interfaces small. Prefer `context.Context` + domain types over wide
parameter objects:

```go
// BAD
type SessionRepo interface {
    Save(ctx context.Context, sessionID, role, content string, tokenCount, turnNumber int, status string) (int64, error)
}

// GOOD — separate concerns
type MessageWriter interface {
    InsertMessage(ctx, sessionID, role, content string, tokenCount, turnNumber int, status string) (int64, error)
}
```

### Dependency Inversion

Handlers depend on abstractions (interfaces), not concrete repos. Use the
repository pattern:

```go
type SessionRepository interface {
    CreateSession(ctx, userID, title) (*models.Session, error)
    InsertMessage(ctx, sessionID, role, content, tokenCount, turnNumber, status) (int64, error)
    // ...
}
```

---

## SOLID — Frontend

### Single Responsibility

One hook = one concern. `useChatStream` handles SSE streaming. `useSessions`
handles CRUD. Do NOT merge them.

### Open/Closed

New packet types in `StreamPacket` discriminated union = add a new union
member. No need to change existing handlers' exhaustiveness checking.

### Interface Segregation

Component props should be minimal — pass only what the component needs:

```go
// BAD
<MessageItem msg={fullMessage} isLast={true} isLoading={true} showSteps={true} />

// GOOD — co-locate related concerns
<MessageItem message={message} context={{ isStreaming, isLast }} />
```

### Dependency Inversion

Services should abstract HTTP:

```typescript
interface SessionApi {
    list(): Promise<Session[]>
    getMessages(id: string): Promise<DbMessage[]>
}

// Implementation uses api.get(), mock uses in-memory
```

---

## Clean Code — Universal

### No Star Imports

```
// BAD in Go
import "echo-backend/internal/handler"

// BAD in TypeScript
import * as Store from "@/stores"
```

### No Naked Returns

Always annotate error returns:

```go
// BAD
func (r *Repo) Get(ctx, id) (*Model, error) {
    return nil, nil
}
```

### Error Wrapping

Always wrap errors with context:

```go
return nil, fmt.Errorf("get session %s: %w", id, err)
```

### No `else` After `return`

```go
// BAD
if err != nil {
    return nil, err
} else {
    return result, nil
}

// GOOD
if err != nil {
    return nil, err
}
return result, nil
```

### Context First

Context is always the first parameter in Go functions.

### No Magic Strings

```typescript
// BAD
if (data.type === "debug") { ... }

// GOOD
import { PACKET_TYPES } from "../constants"
if (data.type === PACKET_TYPES.DEBUG) { ... }
```

### Naming Conventions

| Language | Convention | Example |
|---|---|---|
| Go | `camelCase` (unexported), `PascalCase` (exported) | `getUserID`, `SaveTurnMessages` |
| Go files | `snake_case.go` | `session_repository.go` |
| TypeScript | `camelCase` (vars, functions), `PascalCase` (types, interfaces, components) | `sendMessage`, `MessageItem` |
| TypeScript files | `kebab-case.ts` | `chat-api.ts` |
| SQL | `snake_case` | `turn_number`, `session_id` |

### Thread Safety

Shared mutable state must be protected:

```go
type streamContent struct {
    mu       sync.RWMutex
    content  strings.Builder
    isComplete bool
}

// Writer goroutine: Lock
// Reader goroutine: RLock
```

Never share mutable state between goroutines without synchronisation.

### Testability

Functions that perform I/O must accept interfaces, not concrete types.
This allows unit testing without a real database or network.

---

## Linting

Every PR MUST pass these without warnings:

| Layer | Command |
|---|---|
| Go | `golangci-lint run ./internal/...` |
| Frontend | `npx tsc --noEmit` |
| Frontend | `bun run build` |

---

## Entry Points & Exports

- This document
- Referenced from each service's `AGENTS.md` as `<reference>docs/shared/patterns/acid-solid-clean-code.md</reference>`

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
