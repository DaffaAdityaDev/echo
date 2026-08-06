===============================================================================
  Agent Status Protocol - Live State Visibility for Users
===============================================================================
  Module    : Agent Status Protocol
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
===============================================================================

## Description

Protocol for communicating the agent's live execution state to the frontend
so users can see whether the agent is running normally, stalled, looping,
degraded, or completed. Extends the existing SSE packet format with a
status field and adds two new packet types.

---

## Problem

Current SSE packets carry type, content, step number — but no holistic
"what is the agent doing right now" signal. Users see:

  - No output for 10s → "Is it stuck? Did it crash?"
  - Tool call → tool result → tool call → same tool → "Is it looping?"
  - Long reasoning → "Is it still thinking or frozen?"

Current heartbeat (15s) is too infrequent for real-time state feedback.

---

## Architecture

### AgentStatus Field

Added to every `HarnessPacket`:

```typescript
interface AgentStatus {
  state: 'starting' | 'running' | 'stalled' | 'looping' | 'degraded' | 'completed' | 'aborted';
  step: number;
  maxSteps: number;
  strategy: 'agent' | 'standard' | 'restricted';
  lastActivity: string;               // ISO 8601 timestamp
  currentTool?: string;               // tool being executed (if any)
  currentThought?: string;            // latest reasoning snippet (50 chars)
  consecutiveFailures?: number;
  activeCircuitBreakers?: string[];   // tool names with open circuit
  throughput?: number;                // tokens/second (for performance UX)
}
```

> Metadata packets emitted before the status tracker is constructed (the
> first `emitMetadata` calls at the start of `runMission()`) carry no
> `agentStatus` field.

### State Machine

```
                  ┌──────────┐
                  │ starting │
                  └────┬─────┘
                       │
                       ▼
                  ┌──────────┐
    ┌─────────────│ running  │◄────────────────┐
    │             └─────┬────┘                 │
    │                   │                      │
    │         ┌─────────┼─────────┐            │
    │         │         │         │            │
    ▼         ▼         ▼         │            │
┌────────┐ ┌────────┐ ┌────────┐  │            │
│ stalled│ │looping │ │degraded│──┼────────────┘
└────┬───┘ └────┬───┘ └────┬───┘  │
     │          │          │      │
     └──────────┼──────────┘      │
                │                 │
                ▼                 │
           ┌──────────┐          │
           │completed │          │
           └──────────┘          │
           ┌──────────┐          │
           │ aborted  │──────────┘
           └──────────┘
```

Transitions (emitted `state_change` reasons in parentheses):
  - `starting → running` : first packet received (`transition`)
  - `running → stalled`  : no packet for > STALL_TIMEOUT (10s) (`stalled`)
  - `running → looping`  : cosine similarity >= threshold (`cosine_similarity_threshold`)
  - `running → degraded` : consecutive tool failures (`consecutive_tool_failures`)
  - `stalled/looping/degraded → running` : state resets on next status update (`transition`)
  - `* → completed`      : mission finished
  - `* → aborted`        : cancellation or financial abort

The reasons above are the only ones the harness emits — there is no
`loop_resolved` and no `llm_stream_paused` reason.

---

## Heartbeat Protocol

### Implemented (5s interval)

```
SSE: data: {
  "type": "heartbeat",
  "agentStatus": {
    "state": "running",
    "step": 3,
    "maxSteps": 15,
    "strategy": "agent",
    "lastActivity": "2026-07-10T12:00:05Z",
    "currentTool": "web_search",
    "throughput": 42.5
  }
}
```

Emitted by the harness every 5 seconds
(`HARNESS_CONFIG.AGENT_STATUS.HEARTBEAT_INTERVAL`) while the LLM stream is
active but chunks have been stale for the interval. Heartbeats are keepalives
and do NOT reset the harness stall timer.

### Stalled Detection (harness-side, implemented)

- The harness tracks `lastActivityAt`, updated on every non-heartbeat packet
  emission (`sendBase()`).
- The heartbeat ticker checks `Date.now() - lastActivityAt > STALL_TIMEOUT`
  (10s, `HARNESS_CONFIG.AGENT_STATUS.STALL_TIMEOUT`).
- When crossed, `AgentStatusTracker.markStalled()` transitions the state to
  `stalled` (unless terminal) and a single `state_change` packet with reason
  `stalled` is emitted (guarded so it fires once per stall episode).
- When activity resumes, the next status update resets the state.

Frontend behavior is passive: it renders whatever state the wire sends.
If the connection itself dies (>30s with no heartbeat at all), the client
shows "Connection seems lost" + retry button.

---

## State Transition Packets

### `state_change` Packet

```
Emitted when agent status state transitions:

{ type: 'state_change', from: 'running', to: 'looping', reason: 'cosine_similarity_threshold' }
{ type: 'state_change', from: 'running', to: 'degraded', reason: 'consecutive_tool_failures' }
{ type: 'state_change', from: 'running', to: 'stalled', reason: 'stalled' }
{ type: 'state_change', from: 'starting', to: 'running', reason: 'transition' }
```

Frontend uses these for non-intrusive toast notifications.

### `progress` Packet

```
Emitted ONLY after a tool execution completes (phase is always
'tool_execution'):

{ 
  type: 'progress',
  step: 5,
  phase: 'tool_execution',
  tokensUsed: 12450,
  tokensTotal: 128000
}
```

The progress packet carries only `step`/`phase`/`tokensUsed`/`tokensTotal` —
no `maxSteps`, no `estimatedRemaining`, and no other phases
(`reasoning`/`finalizing` are never emitted).

---

## Frontend Components

### State Badge

```
Position: Top-right of chat area, persistent during mission

┌──────────────────────────────────────────────────────┐
│  Echo Agent                               ● Running  │
│  ┌────────────────────────────────────────────────┐  │
│  │ Step 3/15  ────●●○○○○○○○○○○○○                  │  │
│  │                                                │  │
│  │ 🤔 Reasoning: need to find k8s deploy...       │  │
│  │ 🔧 Calling: web_search("kubernetes deploy")    │  │
│  │ ✅ Result: found 3 results                     │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

Badge states:

```
● Running   (green)  → Normal execution, streaming active
◷ Stalled   (yellow) → No content for 10s, heartbeat active
⟳ Looping   (red)    → Repetition detected
⚠ Degraded  (orange) → Strategy degraded to direct mode
✅ Completed (green)  → Mission finished
⛔ Aborted   (red)    → Cancelled or financial abort
```

### Progress Bar

```
Render: ────●●○○○○○○○○○○○○

Rules:
  - step/maxSteps from latest packet or heartbeat
  - If maxSteps unknown (Standard strategy), use indeterminate spinner
  - Color matches state (green/yellow/red/orange)
  - Animate smoothly on step change (CSS transition)

Tooltip on hover:
  "Step 3 of 15 | Using agent mode | 12.4K / 128K tokens"
```

### Tool Call Timeline

```
Compact view (default):
  🔧 web_search("kubernetes deploy")   →   ✅  312ms

Expanded view (click to expand):
  ┌──────────────────────────────────────┐
  │ Input:  { query: "kubernetes..." }  │
  │ Output: Found 3 results              │
  │ Status: success (312ms)              │
  └──────────────────────────────────────┘

Failed tool:
  🔧 web_search("kubernetes deploy")   →   ❌  failed (retry 2/3)

Skipped tool (circuit breaker):
  🔧 web_search("kubernetes deploy")   →   ⛔  circuit open
```

### Degradation Notification

```
When `degraded` packet received:

┌───────────────────────────────────────────────┐
│ ⚠️ Agent switched to direct response mode     │
│ Tool execution errors detected. Continuing    │
│ with knowledge only.                          │
│                                    [Dismiss]  │
└───────────────────────────────────────────────┘
```

Non-blocking toast, auto-dismiss after 8 seconds.

---

## Implementation

### Harness Changes (agent) — implemented

```
harness/status-tracker.ts:
  - AgentStatusTracker holds the AgentStatus state
  - update() refreshes lastActivity + returns { changed, from, to }
  - markStalled() transitions to 'stalled' unless terminal

harness.ts:
  - AgentStatus computed in sendBase() before every packet
  - state_change packet emitted on transition (reasons: transition,
    consecutive_tool_failures, cosine_similarity_threshold, stalled)
  - progress packet emitted after every tool execution
  - 5-second heartbeat during LLM stream inactivity
  - lastActivityAt tracked in sendBase(); STALL_TIMEOUT check in the
    heartbeat ticker → markStalledIfNeeded()

constants.ts:
  - AGENT_STATUS.STALL_TIMEOUT: 10000 (ms)
  - AGENT_STATUS.HEARTBEAT_INTERVAL: 5000 (ms)
```

### Frontend Changes (web)

```
features/chat/hooks/useChatStream.ts:
  - Parses agentStatus from all packets (live via POST /chat/stream)
  - recoverMission(): re-attaches to GET /api/v1/missions/:id/stream after
    page refresh using a localStorage cursor (echo:mission-cursor:{missionId})

features/chat/services/applyStreamPacket.ts:
  - Shared packet dispatcher (live + idempotent replay mode)

features/chat/components/AgentStatusBadge.tsx:
  - Renders badge + progress bar
  - Color transitions, animation

features/chat/components/AgentProgress.tsx:
  - Progress + state display
```

There is no `useAgentStatus` hook and no `AgentStatusObserver` class — the
state machine lives entirely in the harness
(`core/agent/harness/status-tracker.ts`), and the frontend parses
`agentStatus` from the wire in `useChatStream.ts`.

### Terminal Marker

Every mission run records a final `mission_completed` packet into the
Redis mission event store (`mission:events:{missionId}`) in the
`finally` block of `streamHarnessExecution` — so replay consumers know the
stream is over and can close. On execution errors, the `error` packet is also
recorded and treated as terminal by the stream endpoint
(`mission-stream.ts isTerminalPacket`).

---

## Packet Types (Additions)

+-----------------+----------------------------------------+------------------------------------------+
| Type            | Description                            | Emitted When                             |
+-----------------+----------------------------------------+------------------------------------------+
| `state_change`  | Status state transition                | State machine transition                 |
| `progress`      | Checkpoint progress update             | After compaction, tool step, or phase    |
| `heartbeat`     | Connection keepalive with state        | Every 5s during LLM stream inactivity    |
+-----------------+----------------------------------------+------------------------------------------+

---

## Entry Points & Exports

+-----------------------------+----------------------------------+--------------------------------------------+
| Export                      | Source                           | Type                                       |
+-----------------------------+----------------------------------+--------------------------------------------+
| `AgentStatusTracker`        | `harness/status-tracker.ts`      | Class (owns AgentStatus state)             |
| `AgentStatus`               | `shared/types/index.ts:99-110`   | Wire type (wire sends activeCircuitBreakers, currentThought, lastActivity ISO string) |
| `AgentStatusBadge`          | `frontend/web/src/features/chat/ | React component                            |
|                             |   components/AgentStatusBadge.tsx`|                                           |
+-----------------------------+----------------------------------+--------------------------------------------+

---

## Source References

+--------------------------+----------------------------------------------+-------------------------------------------------------+
| Ref                      | File                                         | Key Lines                                             |
+--------------------------+----------------------------------------------+-------------------------------------------------------+
| Typed emit methods       | `harness/events.ts:11`               | sendBase() + typed emit*() methods (no generic emit)  |
| Status tracker           | `harness/status-tracker.ts:3-52`       | AgentStatusTracker (update, markStalled)              |
| Packet types             | `shared/types/index.ts:69-92`          | AgentPacketType union                                 |
| Packet type shapes       | `shared/types/index.ts:112-193`        | HarnessPacket discriminated union (flat, no meta)     |
| Heartbeat + stall        | `harness/stream-processor.ts:34`      | Heartbeat interval + STALL_TIMEOUT check              |
| Frontend types           | `frontend/web/src/features/chat/types/ | StreamPacket + AgentStatus discriminated union        |
|                          |   index.ts:114-122`                    | (activeCircuitBreakers, currentThought, lastActivity: string) |
| Cancel manager           | `harness/cancel_manager.ts`            | Abort controller for disconnect detection              |
+--------------------------+----------------------------------------------+-------------------------------------------------------+

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
