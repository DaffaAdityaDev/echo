===============================================================================
  Circuit Breaker - Per-Tool Resilience & Strategy Degradation
===============================================================================
  Module    : Circuit Breaker Pattern
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-10
===============================================================================

## Description

Per-tool circuit breaker pattern that prevents context bloat, cost spirals,
and infinite retry loops when the LLM hallucinates or repeatedly fails
tool calls. Extends the NLAH harness with bounded retry, exponential backoff,
observation compression for failed calls, and graceful strategy degradation.

---

## Problem

The LLM (especially frontier models in ReAct mode) frequently hallucinates
tool calls — calling the wrong tool, passing malformed arguments, or calling
a tool that is unavailable. Each failure adds two messages to context:

  AIMessage { tool_calls: [badCall] }    → ~200 tokens
  ToolMessage { status: 'error', ... }   → ~500 tokens (full error trace)

Over 15 iterations (MAX_ITERATIONS), 5+ failed calls can waste 3,500+
tokens on dead ends. Context bloat degrades quality and increases cost.

Current harness (`nlah/harness.ts`) catches errors as `Observation` but:
  - No per-tool retry tracking
  - No circuit breaker per tool
  - No distinction between "first time failing" and "failing for the 5th time"
  - Failed calls stay in full detail (error traces, stack, etc.)
  - Strategy is always NLAH — never degrades to Standard

---

## Architecture

### Per-Tool Circuit State

```
Mission-level registry (in-memory, Map<toolName, CircuitState>):

CircuitState {
  failures: number                // consecutive failures
  lastFailureAt: timestamp        // for optional cooldown
  state: 'closed' | 'open'       // closed = can call, open = blocked
  totalRetries: number            // lifetime (for telemetry)
}

Thresholds (HARNESS_CONFIG):
  OPEN_AFTER: 3 consecutive failures
  MAX_RETRIES_PER_TOOL: 3        // total per mission
```

### Flow Diagram

```
                    ┌──────────────────────────────┐
                    │    Harness iteration          │
                    │    provider.stream()          │
                    │    → toolCall event           │
                    └──────────┬───────────────────┘
                               │
                               ▼
               ┌──────────────────────────────┐
               │  Look up CircuitState         │
               │  for toolName                 │
               └──────────┬───────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
   ┌──────────────────────┐  ┌──────────────────────┐
   │ state === 'open'     │  │ state === 'closed'    │
   │                      │  │                       │
   │ Skip execution       │  │ Execute tool          │
   │ Inject 1-line msg:   │  │                       │
   │ "Tool X: circuit     │  │ ┌─────────────────┐   │
   │  open (3 failures)"  │  │ │ success → reset  │   │
   │                      │  │ │ failures = 0     │   │
   │ Emit tool_skip       │  │ │ state = 'closed' │   │
   │ packet (new type)    │  │ └─────────────────┘   │
   └──────────────────────┘  │ ┌─────────────────┐   │
                              │ │ error → increment│   │
                              │ │ failures++       │   │
                              │ │ if failures >= 3 │   │
                              │ │   → state = 'open'│  │
                              │ └─────────────────┘   │
                              └──────────────────────┘
```

### Observation Compression

When a tool call fails, compress the error observation to minimum tokens:

```
Before (current — ~500+ tokens):
  AIMessage {
    content: "...",
    tool_calls: [{ name: "web_search", args: { query: "..." } }]
  }
  ToolMessage {
    content: Observation {
      status: "error",
      summary: "Failed to fetch search results: HTTP 500 Internal Server Error. The upstream search provider returned an unexpected status code. This could be due to network issues, rate limiting, or a temporary outage.",
      error: "TOOL_EXECUTION_FAILED",
      data: { fullError: ..., stackTrace: ..., headers: ... }
    }
  }

After (compressed — ~120 tokens):
  AIMessage {
    content: "...",
    tool_calls: [{ name: "web_search", args: { query: "..." } }]
  }
  ToolMessage {
    content: Observation {
      status: "error",
      summary: "web_search failed: HTTP 500 (retry 2/3)",
    }
  }
```

Compression rules:
  - Keep only `status`, `summary` (truncated to 1 sentence)
  - Drop `error`, `data`, `artifacts`, full stack traces
  - Append `(retry N/3)` or `(circuit open)` to summary
  - If `failures >= 3` and circuit open: set summary to empty string
    (no point showing the same error a 4th time)

### Context Integrity

When circuit is open for a tool, the harness must:
  1. NOT push the tool call to message history at all
  2. Inject a single synthetic AIMessage: "Tool X is temporarily unavailable due to repeated errors. Continuing without it."
  3. Emit `tool_skip` packet to frontend

This prevents the LLM from "seeing" that it tried and failed — which often
triggers another attempt. The circuit breaker is transparent to the LLM.

---

## Strategy Degradation

### Trigger

```
consecutiveFailedIterations >= DEGRADE_AFTER (default: 3)

consecutiveFailedIterations = number of consecutive iterations where:
  - A tool call was made AND
  - The tool execution returned an error

Reset to 0 when:
  - Any tool succeeds
  - A content-only (no tool) iteration completes
```

### Degradation Levels

```
Level 0: NLAH (normal) — full agent with tool binding
Level 1: NLAH (restricted) — toolMap emptied, agent can only generate content
Level 2: Standard — switch to StandardStrategy (direct chat, no tools)
```

### Flow

```
consecutiveFailedIterations:
  0-2  → Level 0 (normal)
  3    → Level 1: clear toolMap, inject "System: tool execution errors detected.
         Continuing with knowledge only."
  5    → Level 2: switch strategy to StandardStrategy, clear messages except
         anchor + last user message, inject "System: switching to direct response."
  7    → Abort with FINANCIAL_ABORT (same as cost cap)
```

### Packet Communication

When degradation occurs, emit:

```
{ type: 'degraded', from: 'agent', to: 'standard', reason: 'consecutive_tool_failures' }
{ type: 'degraded', from: 'nlah', to: 'restricted', reason: 'circuit_breakers_open' }
```

Frontend uses these to update the state badge.

---

## Configuration (HARNESS_CONFIG additions)

```
CIRCUIT_BREAKER = {
  OPEN_AFTER: 3,
  MAX_RETRIES_PER_TOOL: 3,
  COMPRESS_OBSERVATIONS: true,
}

DEGRADATION = {
  DEGRADE_AFTER: 3,
  ABORT_AFTER: 7,
}
```

---

## Packet Types (Additions)

+-------------+---------------------------+------------------------------------------+
| Type        | Description               | Emitted When                             |
+-------------+---------------------------+------------------------------------------+
| `tool_skip` | Tool call skipped due to  | Circuit breaker open for tool            |
|             | circuit breaker           |                                          |
| `degraded`  | Strategy degradation      | consecutiveFailedIterations >= threshold |
+-------------+---------------------------+------------------------------------------+

---

## Entry Points & Exports

+-----------------------------+----------------------------------+--------------------------------------------+
| Export                      | Source                           | Type                                       |
+-----------------------------+----------------------------------+--------------------------------------------+
| `CircuitBreaker`            | `nlah/circuit_breaker.ts`        | Class (Map-based state per mission)        |
| `DegradationManager`        | `nlah/degradation.ts`            | Class (tracks consecutive failures)        |
| `compressObservation()`     | `nlah/utils/compress.ts`         | Function (Observation → compressed)        |
| `CIRCUIT_BREAKER_CONFIG`    | `nlah/constants.ts`              | Constants addendum                         |
+-----------------------------+----------------------------------+--------------------------------------------+

---

## Source References

+--------------------------+------------------------------------------+-------------------------------------------------------+
| Ref                      | File                                     | Key Lines                                             |
+--------------------------+------------------------------------------+-------------------------------------------------------+
| Tool execution error     | `harness/nlah/harness.ts:366-480`        | Current error → Observation mapping                  |
| Compaction               | `harness/nlah/harness.ts:208-260`        | Existing token-based context compression              |
| HARNESS_CONFIG           | `harness/nlah/constants.ts`              | MAX_ITERATIONS: 15, COMPACTION_RATIO: 0.9, etc.       |
| Loop detection           | `harness/nlah/harness.ts:331-341`        | Cosine similarity thought comparison                  |
| Stuck check              | `harness/nlah/harness.ts:517-539`        | Tier 2 recovery — separate LLM call                   |
+--------------------------+------------------------------------------+-------------------------------------------------------+

===============================================================================
  (c) 2026 Echo — All Rights Reserved
===============================================================================
