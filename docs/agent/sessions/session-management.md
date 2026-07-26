===============================================================================
  Session Management - Go Backend as Session Authority
===============================================================================
  Module    : Session Management
  Service   : agent
  Version   : 1.1
  Updated   : 2026-07-23 (incremental PG flush, message status, auto-create session)
===============================================================================

## Description

Session management architecture where the Go Fiber backend acts as the
**sole session authority** — owning session CRUD, message persistence, token
accounting, and history pruning. The Agent (Hono) becomes a **stateless compute
layer** that loads history from Go and commits completed turns back.

This replaces the current model where the frontend (Zustand) is the canonical
history holder and the Agent stores internal state per missionId.

---

## Current vs Proposed Architecture

### Current (Frontend-Driven — History Fragmented)

```
Frontend (Zustand) ← canonical history
  │  POST { message, model, history[], missionId? }
  ▼
Go (proxy only — no history storage)
  │  POST { message, history, provider_config }
  ▼
Agent (stateful — mission state in-memory/redis)
  │  stateStorage.get/set per turn
  ▼
LLM
```

Problems:
  - Frontend sends full history every request (token waste over network)
  - Agent state is per-missionId, not per-session
  - No cross-mission history
  - Hard consolidation impossible (no centralized history store)
  - KV cache benefit limited (prompt rebuilt from frontend data)

### Proposed (Go as Session Authority — Agent Stateless)

```
Frontend
  │  POST { message, sessionId, model, features }
  ▼
Go (session authority — owns history)
  │  1. Load session + messages from PostgreSQL
  │  2. Detect token threshold (SUM token_count)
  │  3. If overflow → trigger hard consolidation via Agent
  │  4. Append user message to session
  │  5. Forward to Agent with full message array + sessionId
  ▼
Agent (stateless compute — pure LLM orchestration)
  │  1. Run ReAct loop (tool calls in-memory only)
  │  2. On completion → emit final SSE packet with:
  │     { type: 'turn_complete', content, toolCalls[], tokenCount }
  ▼
Go (commit)
  │  6. Receive turn_complete packet
  │  7. INSERT assistant messages to session
  │  8. UPDATE token_count per message
  │  9. Forward SSE stream to frontend (or buffer then flush)
  ▼
Frontend
```

---

## Session CRUD Endpoints

### Go Backend — New Routes

```
POST   /v1/sessions                → Create session
GET    /v1/sessions                → List sessions (by user)
GET    /v1/sessions/:id            → Load session metadata + message count
GET    /v1/sessions/:id/messages    → HandleGetSessionMessages
DELETE /v1/sessions/:id            → Delete session

POST   /v1/sessions/:id/prune      → Trigger hard consolidation (internal)
```

### Request/Response Shapes

```
POST /v1/sessions
  Request:  { title?: string }
  Response: { sessionId: string, createdAt: timestamp }
  Auth: User JWT
  Notes: Auto-links to authenticated user_id from JWT sub claim

GET /v1/sessions
  Response: { sessions: [{ id, title, messageCount, tokenCount, createdAt, updatedAt }] }
  Auth: User JWT
  Notes: Paginated, ordered by updatedAt DESC

DELETE /v1/sessions/:id
  Auth: User JWT
  Notes: Soft-delete (status = 'deleted'). Hard cleanup via cron.
```

---

## Database Schema

### `sessions` Table

```sql
CREATE TABLE sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT DEFAULT '',
    context_summary TEXT DEFAULT '',
    status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id, updated_at DESC);
```

### `messages` Table

```sql
CREATE TABLE messages (
    id          BIGSERIAL PRIMARY KEY,
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool_result', 'thought', 'tool_call')),
    content     TEXT NOT NULL,
    token_count INTEGER DEFAULT 0,          -- accurate token count from LLM response
    turn_number INTEGER NOT NULL,           -- sequential per session
    steps       JSONB,                      -- thought process: reasoning, tool_calls, tool_results
    status      TEXT NOT NULL DEFAULT 'complete'
                CHECK (status IN ('streaming', 'complete', 'interrupted')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Status semantics:
--   streaming   — assistant message being written (partial content in DB)
--   complete    — turn completed normally
--   interrupted — stream disconnected; partial content preserved

CREATE INDEX idx_messages_session ON messages(session_id, turn_number);
CREATE INDEX idx_messages_session_status ON messages(session_id, status);
```

**Token Accounting:**
  - `token_count` is populated from the LLM response metadata, NOT computed server-side
  - Agent sends per-message token count in the `turn_complete` SSE packet
  - Go aggregates via: `SELECT SUM(token_count) FROM messages WHERE session_id = $1`
  - Threshold check before every turn: if sum >= PRUNE_THRESHOLD → trigger pruning

---

## Turn Lifecycle

### Intra-Turn Memory Boundary (Critical)

During a single user turn, the Agent may execute a ReAct loop with multiple
tool calls. These intermediate messages exist ONLY in the Agent's in-memory
request lifecycle:

```
Turn N starts:
  1. User sends: "Deploy to K8s"
  2. Go saves user message immediately (status=complete)
  3. Go inserts assistant placeholder (status=streaming)
  4. Agent ReAct loop (in-memory only):
     → call web_search     ← AIMessage + ToolMessage (in-memory)
     → call code_execute   ← AIMessage + ToolMessage (in-memory)
     → synthesize answer   ← final response
  5. Agent streams tokens → Go proxies to frontend + flushes to PG every 2s
  6. Agent emits turn_complete packet to Go:
     { type: 'turn_complete', content: 'To deploy to K8s...',
       toolCalls: [...], tokenCount: 580 }

Go finalizes:
  UPDATE messages SET content=..., steps=..., status='complete' WHERE id=assistantMsgID
  UPDATE sessions SET updated_at=NOW() WHERE id=sessionID
```

**Rules:**
  - Go NEVER receives intermediate tool calls mid-loop
  - Go ONLY receives the final `turn_complete` packet
  - Tool result content is already **compressed** by the circuit breaker
    before being sent to Go (see circuit-breaker-pattern.md in `execution/`)
  - If the Agent crashes mid-loop, partial content is already flushed to PG
    (every 2s) and the message status remains 'streaming' (or 'interrupted' on
    disconnect)

### Incremental Persistence Flow

Messages are saved incrementally during streaming, not only at turn completion.
This ensures data survival on page refresh or network disconnect.

```
Before stream:
  1. Auto-create session (if req.SessionID == "")
  2. MarkStreamingAsInterrupted(sessionID)  — clean up stale streaming msgs
  3. INSERT user message (status='complete')
  4. INSERT assistant placeholder (status='streaming') → get assistantMsgID

During stream (flush goroutine):
  ┌─ Background goroutine with 2s ticker
  ├─ RLock streamContent → read content
  ├─ UPDATE messages SET content=..., token_count=... WHERE id=assistantMsgID
  └─ Ignores empty content (skip if no tokens yet)

On stream end (turn_complete OR error):
  1. Cancel flush goroutine (prevents races)
  2. Build final content + steps (reasoning + tool_calls + tool_results)
  3. Determine status:
       turn_complete → 'complete'
       error         → 'interrupted'
  4. UPDATE messages SET content, steps, status, token_count WHERE id=assistantMsgID
  5. UPDATE sessions SET updated_at = NOW() WHERE id = sessionID
```

### streamContent — Thread-Safe Accumulation

```go
type streamContent struct {
    mu          sync.RWMutex
    content     strings.Builder
    thinking    strings.Builder
    toolCalls   []ToolCallCapture
    toolResults []ToolCallResult
    isComplete  bool
}
```

The `SendStreamWriter` callback and the flush goroutine share this struct via
`sync.RWMutex`:
- Read loop acquires `Lock` to append tokens
- Flush goroutine acquires `RLock` to read accumulated content
- No data races, no channel complexity

### Message Status Lifecycle

```
Before stream:  status='streaming'  (empty placeholder)
During stream:  status='streaming'  (partial content flushed every 2s)
Turn complete:  status='complete'   (final content + steps)
Error/refresh:  status='interrupted' (partial content preserved)
New turn:       prev 'streaming' → 'interrupted' (cleanup)
```

---

## Hard Consolidation (Pruning)

### Trigger

Go checks token threshold before every turn:

```go
const PRUNE_THRESHOLD = 100_000  // tokens — trigger at ~80% of 128K window

func checkPruneThreshold(db, sessionID) {
    total := querySumTokenCount(db, sessionID)
    if total >= PRUNE_THRESHOLD {
        triggerConsolidation(db, sessionID)
    }
}
```

### Delegated Execution

Go does NOT have an LLM — consolidation is delegated to Agent:

```
Go detects threshold exceeded
  │
  │ HTTP POST → Agent /api/internal/sessions/summarize
  │ { session_id, messages: [{ role, content }] }  ← oldest N messages
  │
  ▼
Agent (stateless)
  │  Calls LLM with summarization prompt
  │  Returns: { summary: "User asked about deployment...", token_count: 120 }
  │
  ▼
Go receives summary
  │  1. Append summary to BLOCK 3:
  │     UPDATE sessions SET context_summary = summary WHERE id = session_id
  │  2. DELETE oldest N messages from messages table
  │  3. Log pruning event
  │
  ▼
Next turn → prompt built from: system + tools + context_summary + remaining history
             BLOCK 3 updated → one controlled cache miss
```

### Consolidation Endpoint

```
POST /api/internal/sessions/summarize
  Host: Agent Hono (Go → Agent HTTP call, NOT a Go route)
  Auth: X-Internal-Token
  Request: {
    session_id: string,
    messages: [{ role: string, content: string }],  // oldest 50% of turns
    max_summary_tokens: 500
  }
  Response: {
    summary: string,
    token_count: number,
    messages_summarized: number
  }
```

---

## Integration with 5-Block Prompt Architecture

### History Loading Flow

```
Frontend → POST /v1/chat { message, sessionId, model, features }

Go ChatHandler:
  1. Load session: SELECT * FROM sessions WHERE id = sessionId
  2. Load messages: SELECT * FROM messages WHERE session_id = sessionId
                   ORDER BY turn_number ASC
  3. Check threshold → trigger consolidation if needed
  4. Append current user message (not yet committed)
  5. Build prompt:

     BLOCK 1: Global system instructions
     BLOCK 2: Tool definitions (sorted)
     BLOCK 3: session.context_summary (if exists) + topic additions
     BLOCK 4: loaded messages (turn 1..N) as message array
     BLOCK 5: current user message (latest turn)

  6. Forward to Agent: { sessionId, messages, provider_config, features }

Agent:
  - Receives complete message array (BLOCK 4 already built by Go)
  - Runs ReAct loop in-memory
  - On completion → emit turn_complete packet

Go:
  - Receive turn_complete → INSERT assistant messages + user message to DB
```

### KV Cache Implications

- BLOCK 1-3 = static prefix → high cache hit rate across turns
- BLOCK 4 = loaded from PostgreSQL → identical turns produce identical strings
  → cache hit per turn sequence
- BLOCK 5 = always fresh (user query changes each turn)
- Hard consolidation triggers BLOCK 3 update → ONE miss, then stable again

### Session Endpoints in Go ↔ Agent Bridge

```
Go → Agent (X-Internal-Token, HTTP call):

  POST /api/internal/sessions/summarize
    → Delegated summarization for hard consolidation

Go → Agent (X-Internal-Token, internal):

  POST /api/generate-mission?mode=<mode>
    → Now includes { sessionId, messages[], provider_config, features, skills }
    → messages[] is the FULL BLOCK 4 (not truncated by frontend)
```

---

## Edge Cases

### Concurrent Turns on Same Session

Multiple requests for the same sessionId must be serialized at the Go layer:

```go
var sessionMutex sync.Map  // map[sessionId]chan struct{}

func acquireSessionLock(sessionId string) func() {
    ch := make(chan struct{}, 1)
    actual, loaded := sessionMutex.LoadOrStore(sessionId, ch)
    if loaded {
        actual.(chan struct{}) <- struct{}{}  // wait
    }
    return func() { <-ch }  // release
}
```

Not applicable for typical chat (serial by nature), but required for API access.

### Agent Crash During Turn

- User message is ALREADY committed to DB before the stream starts
  (status='complete') — guaranteed persistence
- Assistant partial content is flushed every 2s (status='streaming')
- On disconnect, Go receives read error → cancel flush goroutine →
  UPDATE message status='interrupted' with whatever content was flushed
- On page refresh, frontend loads the partial message (status='interrupted')
  and shows a subtle warning indicator
- User can send a new message to continue — the interrupted message remains
  visible as context

### Session Migration

- Session data is in PostgreSQL → survives any restart
- Agent has zero session state → can scale to zero, restart, deploy without
  affecting ongoing sessions
- Frontend only needs sessionId — can reconnect from any device

---

## Configuration

```
SESSION_MANAGEMENT = {
  ENABLED: true,
  PRUNE_THRESHOLD: 100_000,          // tokens — trigger consolidation at 80%
  PRUNE_KEEP_LATEST_TURNS: 10,       // keep newest N turns after consolidation
  SUMMARIZE_MAX_TOKENS: 500,         // max tokens for summary block
  INTERRUPTED_TURN_TIMEOUT: "24h",   // discard interrupted turns after
}
```

---

## Entry Points & Exports

+-----------------------------+----------------------------------+--------------------------------------------+
| Export                      | Source                           | Type                                       |
+-----------------------------+----------------------------------+--------------------------------------------+
| SessionHandler              | backend/internal/handler/        | Go Fiber handler (CRUD endpoints)          |
|                             |   session_handler.go             |                                            |
| SessionRepository           | backend/internal/repository/     | 16 methods: CreateSession, ListByUser,        |
|                             |   session_repository.go          | GetByID, DeleteSession, UpdateContextSummary,|
|                             |                                | GetSessionMessages, GetSessionTokenCount,   |
|                             |                                | GetMaxTurnNumber, DeleteMessagesUpToTurn,   |
|                             |                                | SaveTurnMessages, InsertMessage,            |
|                             |                                | InsertAssistantPlaceholder,                 |
|                             |                                | UpdateMessageContent, UpdateMessageStatus,  |
|                             |                                | MarkStreamingAsInterrupted,                 |
|                             |                                | UpdateSessionTimestamp                      |
| streamContent               | backend/internal/handler/        | struct in HandleChat SendStreamWriter:      |
|                             |   chat_handler.go               | content, thinking (strings.Builder),       |
|                             |                                | toolCalls, toolResults slices,             |
|                             |                                | isComplete bool, sync.RWMutex              |
| ConsolidationService        | backend/internal/service/        | Orchestrates threshold check → Agent call  |
|                             |   consolidation_service.go      |                                            |
| SummarizeEndpoint           | agent/src/app/api/internal/      | Hono endpoint for LLM summarization        |
|                             |   summarize.ts                  |                                            |
+-----------------------------+----------------------------------+--------------------------------------------+

---

## Source References

+--------------------------+------------------------------------------+-------------------------------------------------------+
| Ref                      | File                                     | Key Lines                                             |
+--------------------------+------------------------------------------+-------------------------------------------------------+
| Current state storage    | agent/src/core/agent/storage/            | Existing IStateStore — to be replaced by session      |
|                          |   backend.ts + memory.ts                 |   loading from Go                                     |
| Current mission          | agent/src/app/api/missions/              | Controller that currently loads from stateStorage     |
| controller               |   mission.controller.ts                  |   → will receive messages[] from Go instead           |
| Chat handler (Go)        | backend/internal/handler/                | Existing proxy — will add session loading + commit    |
|                          |   chat_handler.go                        |                                                       |
| Circuit breaker          | docs/agent/application/features/         | Observation compression applied before commit         |
|                          |   execution/circuit-breaker-pattern.md   |                                                       |
| 5-block cache layout     | docs/shared/architecture/headless-       | BLOCK 4 now loaded from session store                 |
|                          |   haas.md                                |                                                       |
| Context resolver         | docs/agent/application/features/         | Topic additions injected at Go layer                  |
|                          |   execution/context-resolver-pattern.md  |                                                       |
+--------------------------+------------------------------------------+-------------------------------------------------------+

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
