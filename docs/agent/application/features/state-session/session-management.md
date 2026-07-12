===============================================================================
  Session Management - Go Backend as Session Authority
===============================================================================
  Module    : Session Management
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
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
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool_result')),
    content     TEXT NOT NULL,
    token_count INTEGER DEFAULT 0,          -- accurate token count from LLM response
    turn_number INTEGER NOT NULL,           -- sequential per session
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON messages(session_id, turn_number);
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
tool calls. These intermediate messages (AIMessage for tool calls, ToolMessage
for observations) exist ONLY in the Agent's in-memory request lifecycle:

```
Turn N starts:
  1. User sends: "Deploy to K8s"
  2. Agent ReAct loop (in-memory only):
     → call web_search     ← AIMessage + ToolMessage (in-memory)
     → call code_execute   ← AIMessage + ToolMessage (in-memory)
     → synthesize answer   ← final response
  3. Agent emits turn_complete packet to Go:
     { type: 'turn_complete', content: 'To deploy to K8s...',
       toolCalls: [{ name: 'web_search', result: '...', tokenCount: 320 }],
       tokenCount: 580 }

Go commits ONE turn to DB:
  INSERT INTO messages (session_id, role, content, token_count, turn_number)
  VALUES
    ('...', 'user',    'Deploy to K8s',                 10,   N),
    ('...', 'assistant', 'To deploy to K8s...',           580, N),
    ('...', 'tool_result', 'web_search result: ...',      320, N)
```

**Rules:**
  - Go NEVER receives intermediate tool calls mid-loop
  - Go ONLY receives the final `turn_complete` packet
  - Tool result content is already **compressed** by the circuit breaker
    before being sent to Go (see circuit-breaker-pattern.md in `execution/`)
  - If the Agent crashes mid-loop, the entire turn is lost — Go has no partial
    data to roll back. This is acceptable: the user retries.

### SSE Transaction/Commit Policy

Race condition: Agent streams tokens to Go, Go forwards to frontend.
If connection drops mid-stream, Go must not commit partial data.

```
1. Agent begins streaming tokens → Go proxies to frontend (real-time)
2. Agent finishes → sends turn_complete packet as LAST SSE event
3. Go receives turn_complete → commits to PostgreSQL
4. If connection drops BEFORE turn_complete:
   → Go has buffered partial content
   → Go marks turn as 'interrupted' (optional: save partial buffer)
   → On next session load, frontend sees interrupted turn
5. If connection drops AFTER turn_complete:
   → Go already committed — next session load shows complete turn
```

Implementation:

```go
// In ChatHandler.HandleChat (Go)
pendingTurn := &TurnBuffer{
    SessionID:    sessionID,
    TurnNumber:   nextTurn,
    Content:      strings.Builder{},
    ToolCalls:    []ToolCall{},
    TokenCount:   0,
    IsComplete:   false,
}

for packet := range agentSSEStream {
    switch packet.Type {
    case "content":
        pendingTurn.Content.WriteString(packet.Data)
        c.Write(packet.Raw)  // forward to frontend immediately
    case "turn_complete":
        pendingTurn.TokenCount = packet.TokenCount
        pendingTurn.ToolCalls = packet.ToolCalls
        pendingTurn.IsComplete = true
        commitTurn(db, pendingTurn)  // ONLY commit here
    case "error":
        if !pendingTurn.IsComplete {
            saveInterrupted(db, pendingTurn)
        }
    }
}
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

- If Agent crashes before `turn_complete`, Go has no assistant response to commit
- User's `message` is NOT yet committed to DB (Go appends in-memory only)
- On retry, user resends the same message — Go treats it as new turn
- No duplicate messages because the user message was never committed
- Acceptable trade-off: simplicity > resilience for edge case

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
| SessionRepository           | backend/internal/repository/     | 10 methods: CreateSession, ListByUser,       |
|                             |   session_repository.go          | GetByID, DeleteSession, UpdateContextSummary,|
|                             |                                | GetSessionMessages, GetSessionTokenCount,   |
|                             |                                | GetMaxTurnNumber, DeleteMessagesUpToTurn,   |
|                             |                                | SaveTurnMessages                            |
| TurnBuffer (inline vars)    | backend/internal/handler/        | Inline variables in HandleChat:             |
|                             |   chat_handler.go               | assistantBuilder, toolResults, toolCalls,  |
|                             |                                | isComplete (no exported struct)            |
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
