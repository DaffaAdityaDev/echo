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
Gateway relay to the Next.js frontend. One live delivery channel (the agent's
SSE stream, relayed by the gateway); missions are cancelled on disconnect
(token safety) and are not replayed.

## File Structure

+-------------------------------------+---------------------------------------------+
| Location                            | Role                                        |
+-------------------------------------+---------------------------------------------+
| agent/src/adapter/inbound/api/missions/         |                                             |
|   mission.controller.ts             | SSE stream creation                         |
|   mission-execution.ts              | streamHarnessExecution (run + SSE stream)   |
|   stream.transport.ts               | HttpStreamTransport packet writer           |
| agent/src/core/agent/harness/       |                                             |
|   cancel_manager.ts                 | Abort signal per mission                    |
| backend/internal/handler/           |                                             |
|   chat/handler.go                   | HandleChat SSE proxy                        |
| backend/internal/router/router.go   | Route wiring                                |
| frontend/web/src/features/chat/     |                                             |
|   hooks/useChatStream.ts            | SSE packet dispatch                         |
|   services/stream/index.ts          | Shared packet dispatcher                    |
| frontend/web/src/lib/api-client.ts  | ReadableStream SSE parser (stream)          |
| frontend/web/src/app/api/chat/      | Next route handlers (chat stream)           |
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
```

`checkpoint` and `swarm_status` are NOT emitted by the harness — they are
legacy types retained in some client type unions.

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

## Disconnect Handling

Missions are cancelled when the client disconnects — there is no replay or
cursor recovery.

### Server side

The agent's `CancellationManager` ties to the SSE stream lifecycle: on abort
(client disconnected, gateway died) the mission's signal fires and the harness
throws `STREAM_CONSTANTS.CANCELLED_MESSAGE`, which the stream emits as an
`error` packet. The gateway's relay loop (`HandleChat`) keeps flushing
partial content to the DB every 2s and finalizes the turn with
`CompleteTurn` — status `complete` (on `turn_complete`) or `interrupted`
(otherwise). The DB snapshot is the single source of truth after a
disconnect: refresh → messages rebuild from `GET /sessions/:id/messages`.

### Client side

- An `AbortController` is created per `sendMessage()` call and passed to
  `api.stream()`. The controller is aborted when the user stops the stream.
- An `error` packet carrying `CANCELLED_MESSAGE` ("Mission cancelled by
  client disconnect") is surfaced as an **interrupted** turn (badge: "send a
  reply to continue") instead of a completed error — the partial content
  stays and the conversation continues with a new message.
- The stream's catch block silently ignores `AbortError` to prevent console
  noise on intentional cancellation.

## Entry Points & Exports

- **Agent stream writer**: `stream.transport.ts` -> `HttpStreamTransport.send()`
- **Agent mission controller**: `mission.controller.ts` -> `createMission()`
  wraps SSE stream
- **Agent stream executor**: `mission-execution.ts` -> `streamHarnessExecution()`
- **Go SSE proxy**: `chat/handler.go` -> `HandleChat()` streams from agent to
  client
- **Frontend SSE consumer**: `useChatStream.ts` -> `sendMessage()` calls
  `api.stream()`
- **Frontend API streaming**: `api-client.ts` -> `stream()` ReadableStream
  parser

## Source References

+-------------------------------------------------------+-------+---------------------------------------+
| File                                                  | Lines | Role                                  |
+-------------------------------------------------------+-------+---------------------------------------+
| agent/src/adapter/inbound/api/missions/mission.controller.ts      | 152-158| SSE stream creation                   |
| agent/src/adapter/inbound/api/missions/mission-execution.ts      | 1-70  | streamHarnessExecution (run + stream) |
| agent/src/adapter/inbound/api/missions/stream.transport.ts        | 1-26  | HttpStreamTransport packet writer     |
| agent/src/core/agent/harness/cancel_manager.ts        | 1-40  | Abort signal per mission              |
| backend/internal/handler/chat/handler.go              | 148-540| HandleChat SSE proxy                  |
| frontend/web/src/features/chat/hooks/useChatStream.ts | 38-270| SSE packet dispatch, AbortController   |
| frontend/web/src/lib/api-client.ts                    | 56-121| ReadableStream SSE parser             |
| frontend/web/src/features/chat/types/index.ts         | 130-243| StreamPacket type                     |
+-------------------------------------------------------+-------+---------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
