================================================================================
  SSE STREAMING
================================================================================
  Module    : SSE Streaming
  Service   : Shared / Patterns
  Version   : 1.0
  Updated   : 2026-08-06
================================================================================

## Description

End-to-end Server-Sent Events flow from the Hono Agent Engine through the Go
Gateway relay to the Next.js frontend. Supports two runtime modes (local
reverse-proxy and SaaS direct Redis Streams read) with a Redis-backed mission
event store for replay-after-cursor recovery and event type taxonomy.

## File Structure

+-------------------------------------+---------------------------------------------+
| Location                            | Role                                        |
+-------------------------------------+---------------------------------------------+
| agent/src/adapter/inbound/api/missions/         |                                             |
|   mission.controller.ts             | SSE stream creation                         |
|   stream.transport.ts               | HttpStreamTransport packet writer           |
| agent/src/core/agent/harness/       |                                             |
|   cancel_manager.ts                 | Abort signal per mission                    |
| backend/internal/handler/           |                                             |
|   chat/handler.go                   | HandleChat SSE proxy, StreamMissionLogs     |
| backend/internal/router/router.go   | Route wiring                                |
| frontend/web/src/features/chat/     |                                             |
|   hooks/useChatStream.ts            | SSE packet dispatch + recovery              |
|   services/applyStreamPacket.ts     | Shared packet dispatcher (live + replay)    |
|   services/mission-cursor.ts        | localStorage replay cursor (per mission)    |
| frontend/web/src/lib/api-client.ts  | ReadableStream SSE parser (stream/streamGet)|
| frontend/web/src/app/api/missions/  | Next route handlers (stream/approve/deny)   |
| agent/src/adapter/inbound/api/missions/         |                                             |
|   mission-stream.ts                 | Redis event store (XADD/XRANGE/XREAD BLOCK) |
| frontend/web/src/features/chat/     |                                             |
|   types/index.ts                    | StreamPacket type                           |
+-------------------------------------+---------------------------------------------+

## ASCII Flow Diagram

                           SSE STREAM — END TO END
                           ──────────────────────────

  ┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
  │   Next.js Frontend   │     │   Go Fiber Gateway    │     │  Hono Agent Engine   │
  │                      │     │                      │     │                      │
  │ useChatStream()      │     │ HandleChat()          │     │ MissionController    │
  │                      │     │                      │     │                      │
  │  1. POST /api/v1/    │     │  2. Validate req     │     │  4. schema.parse     │
  │     chat             │────►│  3. Forward to Agent │────►│  5. resolveTools     │
  │                      │     │                      │     │  6. Harness.run      │
  │                      │     │                      │     │                      │
  │                      │     │                      │     │  ┌──────────────────┐│
  │                      │     │                      │     │  │  LLM Stream      ││
  │                      │     │                      │     │  │  Tokens/Tools    ││
  │                      │     │                      │     │  └────────┬─────────┘│
  │                      │     │                      │     │           │           │
  │                      │     │                      │     │           ▼           │
  │                      │     │                      │     │  ┌──────────────────┐│
  │                      │     │                      │     │  │ HttpStream       ││
  │                      │     │                      │     │  │ Transport        ││
  │                      │     │                      │     │  │ writeSSE()       ││
  │                      │     │                      │     │  └────────┬─────────┘│
  │                      │     │                      │     │           │           │
  │                      │     │   SSE Chunks via     │     │  data: {type,        │
  │                      │     │   w.Write(buf)       │     │  content, ...}       │
  │                      │     │◄─────────────────────│─────│                      │
  │                      │     │                      │     │                      │
  │  ReadableStream      │     │  Headers:             │     │                      │
  │  .getReader()        │     │   Content-Type:       │     │                      │
  │  -> parse "data:"    │     │    text/event-stream   │     │                      │
  │  -> JSON.parse       │     │   Cache-Control:      │     │                      │
  │  -> onChunk(data)    │◄────│    no-cache           │     │                      │
  │                      │     │   X-Accel-Buffering: │     │                      │
  │                      │     │    no                 │     │                      │
  └──────────────────────┘     └──────────────────────┘     └──────────────────────┘


                         DUAL MODE: MISSION LOG STREAMING
                         ─────────────────────────────────

  ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
  │   Frontend   │     │   Go Gateway     │     │     Redis        │     │   Hono Agent     │
  └──────┬───────┘     └──────┬───────────┘     └──────┬───────────┘     └──────┬───────────┘
         │                    │                         │                       │
         │                    │   LOCAL MODE            │                       │
         │  GET /v1/missions  │  (AGENT_RUNTIME_        │                       │
         │  /:id/stream       │   MODE=local)           │                       │
         │───────────────────►│                         │                       │
         │                    │  GET /api/v1/missions/   │                       │
         │                    │  :id/stream              │──────────────────────►│
         │                    │                         │                       │
         │                    │  bufio copy line-by-line │    SSE: data: {...}   │
         │                    │  from Hono               │◄──────────────────────│
         │  SSE: data: {...}  │                         │                       │
         │◄───────────────────│                         │                       │
         │                    │                         │                       │
         │                    │   SAAS MODE             │                       │
         │  GET /v1/missions  │  (AGENT_RUNTIME_        │                       │
         │  /:id/stream       │   MODE=saas)            │                       │
         │───────────────────►│                         │                       │
         │                    │  SUBSCRIBE              │                       │
         │                    │  stream:{missionId}     │────────────────────►  │
         │                    │                         │                       │
         │                    │                         │   Agent PUBLISHES     │
         │                    │                         │   to stream:id        │
         │                    │                         │◄──────────────────────│
         │                    │  CHANNEL message        │                       │
         │                    │◄────────────────────────│                       │
          │  SSE: data: {...}  │                         │                       │
          │◄───────────────────│                         │                       │
          │                    │  15s heartbeat:         │                       │
          │                    │  ": heartbeat\n\n"      │                       │
          │◄───────────────────│                         │                       │

## Event Types

### Packet Type Taxonomy

```typescript
type AgentPacketType =
  | 'metadata'        // Session metadata, mission ID, strategy info
  | 'reasoning'       // Agent thought process (streamed tokens)
  | 'content'         // Final text content to display to user
  | 'tool_call'       // Agent requests tool execution
  | 'tool_result'     // Tool execution result
  | 'tool_skip'       // Tool skipped due to circuit breaker
  | 'error'           // Execution error
  | 'usage'           // Token usage stats
  | 'todo'            // Task list update
  | 'subagent_call'   // Delegation to sub-agent started
  | 'subagent_result' // Sub-agent completed
  | 'debug'           // Debug information
  | 'state_change'    // Agent state transition (starting → running → stalled → completed)
  | 'degraded'        // Strategy degradation signal
  | 'progress'        // Progress update after tool execution
  | 'heartbeat'       // Live connection keepalive with agent status
  | 'turn_complete'   // Final packet signalling the turn is done
  | 'system_notice'   // System-level notices (budget, loop warnings)
  | 'token_metrics'   // Token usage metrics payload
  | 'hitl_approval_required' // Human-in-the-loop approval request
  | 'mission_completed'     // Mission finished payload
  | 'replay_done'           // Synthetic marker: replayed history segment is over
```

`checkpoint` and `swarm_status` are NOT emitted by the harness — they are
legacy types retained in some client type unions.

`replay_done` is emitted by the mission-stream endpoints (agent
`streamMissionLogs` and the Go gateway saas path) only — it is written
directly to the SSE connection and never recorded to the Redis event store.
It separates the replayed history segment from the live phase: the recovery
client (useChatStream) switches from `replay: true` (skip content/reasoning,
which the DB message already carries) to live application of content deltas
on it. A completed mission whose terminal marker is already in history does
not emit `replay_done`.

## Stream Packet Enrichment

In `HttpStreamTransport.send()`, each packet is enriched:

```typescript
{
  ...originalPacket,      // type, missionId, step, type-specific fields, agentStatus?
  seq: number,            // Auto-incrementing sequence number
  timestamp: number       // Date.now() at send time (single source of truth)
}
```

## Standard Packet Envelope

Every packet (regardless of type) follows this base shape:

```typescript
{
  type: string;              // One of AgentPacketType
  missionId: string;         // Unique mission identifier
  step: number;              // Current iteration step
  seq: number;               // Monotonic sequence number (added by transport)
  timestamp: number;         // Epoch ms (added by transport)
  agentStatus?: AgentStatus; // Present when status tracker is active
  // ... type-specific fields (flat, no 'meta' wrapper)
}
```

**Rules:**
1. All type-specific data is FLAT (not wrapped in `meta:`)
2. `agentStatus` is included on every packet when the agent has a status tracker
3. Fields like `from`, `to`, `reason` for `state_change`/`degraded` are top-level
4. Token usage is in a flat `usage` field, not inside `meta`
5. `timestamp` is set ONLY by `HttpStreamTransport.send()` — not by the harness

## SSE Line Format

```
data: {"type":"content","content":"Hello","seq":1,"timestamp":1712345678000}

data: {"type":"tool_call","toolName":"web_search","seq":2,"timestamp":1712345679000}

data: {"type":"reasoning","content":"Let me search for...","seq":3,"timestamp":1712345680000}

: heartbeat

```

## Frontend Stream Parser (api-client.ts)

```typescript
// 1. POST request to /api/v1/chat
// 2. Get ReadableStream from response.body
// 3. Read chunks with .getReader()
// 4. Decode bytes, split by "\n"
// 5. Strip "data: " prefix
// 6. JSON.parse and call onChunk callback
// 7. Skip "[DONE]" markers and empty lines
// 8. Handle cases where jsonStr isn't valid JSON (fallback to { content: jsonStr })
```

## Frontend Packet Handler (useChatStream.ts)

All packets are read as a discriminated union — TypeScript narrows the shape
based on `data.type`. Fields are FLAT (no `meta:` wrapper):

```typescript
handlePacket(data: StreamPacket) {
  switch (data.type) {
    case "metadata":      -> set missionId, strategy, historyDepth, toolsAvailable from flat fields
    case "reasoning":     -> append data.content to last thought step
    case "content":       -> append data.content to assistant message
    case "tool_call":     -> add step with data.toolName, data.toolInput
    case "tool_result":   -> add step with data.toolName, data.content
    case "tool_skip":     -> add step with data.toolName
    case "todo":          -> add step with data.todos
    case "subagent_call"
         | "subagent_result": -> add step with data.subagent
    case "usage":         -> set data.usage (flat, not inside meta)
    case "swarm_status":  -> update AgentProgress with data.swarm
    case "heartbeat":     -> update agentStatus from data.agentStatus
    case "state_change":  -> set agentState from data.agentStatus.state
    case "degraded":      -> set agentState='degraded'
    case "progress":      -> update iteration from data.step
    case "turn_complete": -> set agentState='completed'
    case "error":         -> show error from data.content
  }
}
```

## Reconnection Strategy

Two layers, both Redis-backed:

### 1. Page refresh recovery (`recoverMission` in useChatStream)

On session load the chat page re-attaches to the mission log stream
(`GET /api/v1/missions/:missionId/stream`) when the session contains assistant
content. The last seen Redis stream ID (`sid`) is persisted per mission in
localStorage (`echo:mission-cursor:{missionId}`):

- Cursor present → server replays only events after the cursor
  (`XRANGE (after +`), then tails live via `XREAD BLOCK`.
- No cursor → live tail only (`after=$`), avoiding duplication with content
  already restored from the database.
- Replay skips `content`/`reasoning` deltas and step packets — the DB message
  already carries them (content is persisted incrementally, steps on
  completion) — and an unexpired `hitl_approval_required` re-opens the HITL
  approval modal. The `replay_done` marker ends the replay segment and switches
  the client to live application of content/step deltas.
- A terminal packet (`mission_completed` / `error`) closes the stream and
  clears the cursor.

### 2. Live stream failure

If `POST /chat/stream` fails mid-mission, the same cursor-based recovery path
can be invoked for the active `missionId` (session id) to catch up and resume
live updates.

The gateway accepts the cursor via query param `?after=<sid>` or the SSE
`Last-Event-ID` header and passes it through in local mode / applies it to
`XRANGE` in SaaS mode.

### Idle-close and recovery persistence

A stream whose history has no terminal marker may never produce one (Redis
stream expired after the 24h TTL, or the agent died mid-run). Both stream
endpoints (agent `streamMissionLogs`, Go gateway SaaS path) therefore close
after an idle window instead of blocking forever:

- **Empty history** — a single-shot 5s window covering the expired/TTL case.
  The first live event proves the mission is genuinely running and cancels the
  timer; a live mission is never cut off on silence.
- **Partial history (no terminal)** — a sliding 60s window reset on every live
  event, so a mission whose agent died mid-run closes instead of hanging.

On a terminal packet the Go gateway's SaaS relay also finalizes the database
message: it reads the FULL `mission:events:{missionId}` stream (independent of
the client's cursor), rebuilds content/steps/token count
(`persistRecoveredMission`, `mission_replay.go`), and calls `CompleteTurn` with
status `complete` (on `mission_completed`) or `interrupted` (on `error`). This
closes the gap where a mission that finished after its SSE connection dropped
stayed `interrupted` forever. Local mode remains store-only — the relay proxies
the agent's stream without DB writes.

On the frontend, `recoverMission` invalidates the messages query on completion
so the rebuilt snapshot reflects the persisted completion. While the snapshot
is still stale (status `interrupted` — local mode, or before the relay
persists), `useChatPage` suppresses the snapshot rebuild so the recovered
content in the store is not clobbered.

## Cancellation

### Server Side (Agent)

The `CancellationManager` in the agent ties to client disconnect:

```typescript
// agent/src/core/agent/harness/cancel_manager.ts
const signal = cancellationManager.register(missionId);

// On client disconnect -> Hono context done -> abort signal
// Harness checks signal.aborted between each packet send
```

### Client Side (Frontend)

An `AbortController` is created per `sendMessage()` call and passed to
`api.stream()` as the 4th argument. The controller is aborted when:

- The user clicks "Clear messages" during an active stream
- The component unmounts (future enhancement: effect cleanup)

```typescript
// frontend/web/src/features/chat/api/useChatStream.ts
abortRef.current = new AbortController();
await api.stream(..., { signal: abortRef.current.signal });

// On clear:
const clearMessages = () => {
  abortRef.current?.abort();
  setMessages([]);
};
```

The stream's catch block silently ignores `AbortError` to prevent
console noise on intentional cancellation.

## Entry Points & Exports

- **Agent stream writer**: `stream.transport.ts` -> `HttpStreamTransport.send()`
- **Agent mission controller**: `mission.controller.ts` -> `createMission()`
  wraps SSE stream
- **Go SSE proxy**: `chat/handler.go` -> `HandleChat()` streams from agent to
  client
- **Go mission log stream**: `chat/handler.go` -> `StreamMissionLogs()` dual-mode
- **Frontend SSE consumer**: `useChatStream.ts` -> `sendMessage()` calls
  `api.stream()`
- **Frontend API streaming**: `api-client.ts` -> `stream()` ReadableStream
  parser

## Source References

+-------------------------------------------------------+-------+---------------------------------------+
| File                                                  | Lines | Role                                  |
+-------------------------------------------------------+-------+---------------------------------------+
| agent/src/adapter/inbound/api/missions/mission.controller.ts      | 152-158| SSE stream creation                   |
| agent/src/adapter/inbound/api/missions/stream.transport.ts        | 1-26  | HttpStreamTransport packet writer     |
| agent/src/core/agent/harness/cancel_manager.ts        | 1-40  | Abort signal per mission              |
| backend/internal/handler/chat/handler.go              | 148-540| HandleChat SSE proxy                  |
| backend/internal/handler/chat/handler.go              | 552-650| StreamMissionLogs dual mode           |
| frontend/web/src/features/chat/api/useChatStream.ts   | 38-270| SSE packet dispatch, AbortController   |
| frontend/web/src/lib/api-client.ts                    | 56-121| ReadableStream SSE parser             |
| frontend/web/src/features/chat/types/index.ts         | 130-243| StreamPacket type                     |
+-------------------------------------------------------+-------+---------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
