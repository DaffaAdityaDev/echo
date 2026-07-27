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

Transitions:
  - `starting → running` : first packet received
  - `running → stalled`  : no packet >10s
  - `running → looping`  : cosine similarity >= threshold + tool failures
  - `running → degraded` : strategy degradation triggered
  - `stalled → running`  : new packet arrives
  - `looping → running`  : loop resolved
  - `degraded → running` : degradation resolved (unlikely)
  - `* → completed`      : mission finished
  - `* → aborted`        : cancellation or financial abort

---

## Heartbeat Protocol

### Current (15s interval)

```
SSE: data: {"type":"heartbeat"}
  → Only confirms connection is alive
  → Says nothing about agent state
```

### Proposed (5s interval + state)

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

Emitted every 5 seconds while the LLM stream is active. If the LLM
stream is between tokens but still connected, heartbeat confirms
"still processing."

For stalled detection:
  - Frontend tracks `timeSinceLastPacket`
  - If `>10s` with heartbeat only (no content/tool packets):
    → Display "Agent is still thinking..."
  - If `>30s` with no heartbeat at all:
    → Display "Connection seems lost" + retry button

---

## State Transition Packets

### `state_change` Packet

```
Emitted when agent status state transitions:

{ type: 'state_change', from: 'running', to: 'looping', reason: 'cosine_similarity_0.95' }
{ type: 'state_change', from: 'running', to: 'degraded', reason: 'consecutive_tool_failures:3' }
{ type: 'state_change', from: 'looping', to: 'running', reason: 'loop_resolved' }
{ type: 'state_change', from: 'running', to: 'stalled', reason: 'llm_stream_paused' }
```

Frontend uses these for non-intrusive toast notifications.

### `progress` Packet

```
Emitted after each checkpoint (compaction, tool step, etc.):

{ 
  type: 'progress',
  step: 5,
  maxSteps: 15,
  phase: 'reasoning' | 'tool_execution' | 'finalizing',
  tokensUsed: 12450,
  tokensTotal: 128000,
  estimatedRemaining: '30s'
}
```

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

### Harness Changes (agent)

```
harness.ts:
  - Compute AgentStatus in sendBase() before every packet
  - Track state transitions vs previous iteration
  - Emit state_change packet on transition
  - Emit progress packet after every checkpoint
  - 5-second heartbeat during LLM stream inactivity

constants.ts:
  - Add STALL_TIMEOUT: 10000 (ms)
  - Add HEARTBEAT_INTERVAL: 5000 (ms)
```

### Frontend Changes (web)

```
features/chat/hooks/useAgentStatus.ts:
  - Parse agentStatus from all packets
  - Track timeSinceLastPacket for stall detection
  - Maintain state machine locally (handle disconnects)

features/chat/components/AgentStatusBadge.tsx:
  - Render badge + progress bar
  - Color transitions, animation

features/chat/components/ToolCallTimeline.tsx:
  - Compact/expanded tool call history
  - Circuit breaker indication

features/chat/components/DegradationToast.tsx:
  - Non-blocking notification
  - Dismiss + reconnect button
```

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
| `AgentStatusObserver`       | `agent-status/observer.ts`       | Class (tracks & emits state changes)       |
| `useAgentStatus()`          | `frontend/.../useAgentStatus.ts` | React hook (frontend state tracking)       |
| `AgentStatusBadge`          | `frontend/.../AgentStatusBadge`  | React component                            |
+-----------------------------+----------------------------------+--------------------------------------------+

---

## Source References

+--------------------------+----------------------------------------------+-------------------------------------------------------+
| Ref                      | File                                         | Key Lines                                             |
+--------------------------+----------------------------------------------+-------------------------------------------------------+
| Typed emit methods       | `harness/harness.ts:60-180`             | sendBase() + typed emit*() methods (no generic emit)  |
| Packet types             | `shared/types/index.ts:17-36`                | AgentPacketType union                               |
| Packet type shapes       | `shared/types/index.ts:56-80`                | HarnessPacket discriminated union (flat, no meta)   |
| Heartbeat current        | `adapter/inbound/api/missions/mission.controller.ts:165` | SSE stream creation                                  |
| Frontend types           | `frontend/web/src/features/chat/types/       | StreamPacket discriminated union                     |
|                          |   index.ts:102-138`                          |                                                      |
| Cancel manager           | `harness/cancel_manager.ts`                  | Abort controller for disconnect detection             |
+--------------------------+----------------------------------------------+-------------------------------------------------------+

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
