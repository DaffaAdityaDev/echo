================================================================================
  SSE STREAMING
================================================================================
  Module    : SSE Streaming
  Service   : Shared / Patterns
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

End-to-end Server-Sent Events flow from the Hono Agent Engine through the Go
Gateway relay to the Next.js frontend. Supports two runtime modes (local
reverse-proxy and SaaS Redis Pub/Sub) with reconnection strategy and event type
taxonomy.

## File Structure

+-------------------------------------+---------------------------------------------+
| Location                            | Role                                        |
+-------------------------------------+---------------------------------------------+
| agent/src/app/api/missions/         |                                             |
|   mission.controller.ts             | SSE stream creation                         |
|   stream.transport.ts               | HttpStreamTransport packet writer           |
| agent/src/core/agent/harness/       |                                             |
|   cancel_manager.ts                 | Abort signal per mission                    |
| backend/internal/handler/           |                                             |
|   chat_handler.go                   | HandleChat SSE proxy, StreamMissionLogs     |
| backend/internal/router/router.go   | Route wiring                                |
| frontend/web/src/features/chat/     |                                             |
|   api/useChatStream.ts              | SSE packet dispatch                         |
| frontend/web/src/lib/api-client.ts  | ReadableStream SSE parser                   |
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
         │                    │  15s heartbeat: \n\n    │                       │
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
  | 'error'           // Execution error
  | 'checkpoint'      // State recovery marker
  | 'usage'           // Token usage stats
  | 'todo'            // Task list update
  | 'subagent_call'   // Delegation to sub-agent started
  | 'subagent_result' // Sub-agent completed
  | 'swarm_status'    // Web swarm crawl progress
  | 'debug'           // Debug information
```

## Stream Packet Enrichment

In `HttpStreamTransport.send()`, each packet is enriched:

```typescript
{
  ...originalPacket,      // type, content, toolName, etc.
  seq: number,            // Auto-incrementing sequence number
  timestamp: number       // Date.now() at send time
}
```

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

```typescript
handlePacket(data) {
  switch (data.type) {
    case "metadata":   -> set mission meta, maxIterations
    case "usage":      -> set token usage info
    case "content":    -> append to assistant message content
    case "reasoning":  -> append to last thought step
    case "tool_call":  -> add step, increment iteration, show current tool
    case "tool_result":-> add step, clear current tool
    case "todo":       -> add step with todo list
    case "subagent_call": -> add step with subagent info
    case "subagent_result": -> add step with result
    case "swarm_status": -> update swarm progress (activeUrls, counts)
  }
}
```

## Reconnection Strategy

Currently basic — no automatic reconnection. Client error handler catches
failures:

```typescript
catch (err) {
  setMessages(prev => [...prev, {
    content: `Error: ${err.message || "Failed to fetch response from agent."}`
  }]);
}
```

**Planned improvements**:
- Retry with exponential backoff (3 attempts)
- Resume from last `checkpoint` packet
- Send `missionId` in reconnect to recover state

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
- **Go SSE proxy**: `chat_handler.go` -> `HandleChat()` streams from agent to
  client
- **Go mission log stream**: `chat_handler.go` -> `StreamMissionLogs()` dual-mode
- **Frontend SSE consumer**: `useChatStream.ts` -> `sendMessage()` calls
  `api.stream()`
- **Frontend API streaming**: `api-client.ts` -> `stream()` ReadableStream
  parser

## Source References

+-------------------------------------------------------+-------+---------------------------------------+
| File                                                  | Lines | Role                                  |
+-------------------------------------------------------+-------+---------------------------------------+
| agent/src/app/api/missions/mission.controller.ts      | 85-116| SSE stream creation                   |
| agent/src/app/api/missions/stream.transport.ts        | 1-26  | HttpStreamTransport packet writer     |
| agent/src/core/agent/harness/cancel_manager.ts        | 1-40  | Abort signal per mission              |
| backend/internal/handler/chat_handler.go              | 92-233| HandleChat SSE proxy                  |
| backend/internal/handler/chat_handler.go              | 236-  | StreamMissionLogs dual mode           |
|                                                       | 340   |                                       |
| frontend/web/src/features/chat/api/useChatStream.ts   | 38-270| SSE packet dispatch, AbortController   |
| frontend/web/src/lib/api-client.ts                    | 56-121| ReadableStream SSE parser             |
| frontend/web/src/features/chat/types/index.ts         | 62-95 | StreamPacket type                     |
+-------------------------------------------------------+-------+---------------------------------------+

================================================================================
  (c) 2026 Echo — All Rights Reserved
================================================================================
