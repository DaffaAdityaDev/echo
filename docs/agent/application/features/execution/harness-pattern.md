================================================================================
  Agent Harness - Core Execution Loop
================================================================================
  Module    : Agent Execution Harness
  Service   : agent
  Version   : 1.0
  Updated   : 2026-08-06
===============================================================================

## Description

Core execution loop for running agent missions. The NLAH harness (internal
driver for Iterative Agent mode) drives iterations: streaming LLM responses,
detecting tool calls, executing tools,
auto-recovering from failures, and managing context window via compaction.

An optional **behavior prompt** (DB-driven, see
`docs/agent/domain/prompt-engineering.md`) can be attached via
`HarnessConfig.behaviorPrompt` — the harness passes it to the strategy's
`buildSystemPrompt`, enforces its `boundTools` allowlist in `selectTools`,
and persists it in the harness snapshot so HITL resume restores the same
behavior.

---

## File Structure

```
harness/
  index.ts                   # Barrel — re-exports all public API
  types.ts                   # HarnessConfig, HarnessRuntimeConfig, HarnessEvent
  cancel_manager.ts          # AbortController-based cancellation (singleton)
  constants.ts               # HARNESS_CONFIG, PACKET_TYPES, OPERATION_STATUS
  prompts.ts                 # System prompts for compaction, recovery, stuck
  harness.ts                 # NlahHarness — primary execution loop
  circuit_breaker.ts         # CircuitBreaker — per-tool retry tracking
  degradation.ts             # DegradationManager + DegradationLevel
  debug.ts                   # queuePromptDebug — async prompt ledger writer
  compressor.ts              # compressObservation — tool error compression
  status-tracker.ts          # AgentStatusTracker
  context_manager.ts         # ContextManager — prompt/message preparation
  budget_monitor.ts          # BudgetMonitor — cost cap enforcement
  hitl_guard.ts              # HitlGuard — HITL approval for protected tools
  loop_detector.ts           # LoopDetector — exact tool-call loop detection
```

---

## Flow Diagram - Main Loop

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │                     AgentHarness(config)                              │
  │  HarnessFactory.create('nlah', config) → new NlahHarness(...)        │
  └────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │  ┌─────────────────────────────────────────────────────────────────┐  │
  │  │                MAIN LOOP (while not complete)                   │  │
  │  │                                                                 │  │
  │  │  1. Check cancellationManager.isAborted(missionId)              │  │
  │  │                                                                 │  │
  │  │  2. Check PACING_THRESHOLD (iter > 5)                           │  │
  │  │     → Force synthesis, revoke tool access                       │  │
  │  │                                                                 │  │
  │  │  3. Check COMPACTION_RATIO (>90% context window)                │  │
  │  │     → Compact: anchor + summary + last N turns                  │  │
  │  │                                                                 │  │
  │  │  4. Debug gates: queuePromptDebug() if DEBUG_PROMPT             │  │
  │  │                                                                 │  │
  │  │  5. provider.stream(messages, tools, systemPrompt)              │  │
  │  │     → reasoning → emit REASONING                               │  │
  │  │     → content   → emit CONTENT                                 │  │
  │  │     → toolCall  → pendingToolCall                              │  │
  │  │     → usage     → emit USAGE, accumulate cost                  │  │
  │  │                                                                 │  │
  │  │  5b. Budget check (cost >= cap):                                │  │
  │  │      → updateStatus('aborted'), isComplete = true (NO throw)   │  │
  │  │                                                                 │  │
  │  │  6. Check cosine similarity (loop detection)                    │  │
  │  │     If >= 0.92: inject repeating warning                        │  │
  │  │                                                                 │  │
  │  │  7. Tool Resolution (3 paths):                                  │  │
  │  │     Path 1: Native toolCall → execute → emit tool               │  │
  │  │     Path 2: Raw XML tool tags → Soft Recovery                   │  │
  │  │     (parseXmlToolCall - rerouted, never final)                  │  │
  │  │     Path 3: No tool detected  → Tier 2 Stuck Check              │  │
  │  │  8. stateStorage.set(missionId, state) after each turn          │  │
  │  │                                                                 │  │
  │  └─────────────────────────────────────────────────────────────────┘  │
  │                                                                       │
  │  stateStorage.set(missionId, state)  // Final save                   │
  │  trace.end()                          // Langfuse trace              │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## Cancel Manager Flow

```
    ┌───────────────────────────────────────────────────────────────┐
    │              Client connects via SSE                          │
    └──────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
    ┌───────────────────────────────────────────────────────────────┐
    │  cancellationManager.register(missionId)                      │
    │    → new AbortController() → return signal                    │
    └──────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
    ┌───────────────────────────────────────────────────────────────┐
    │  Harness iteration checks signal.aborted                       │
    └──────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
    ┌───────────────────────────────────────────────────────────────┐
    │  Client disconnects                                            │
    │  cancellationManager.cancelLocal(missionId)                    │
    │    → controller.abort()                                       │
    │    → harness checkCancellation() → emits metadata packet       │
    │      ("Mission execution cancelled.") → break loop             │
    │    (no 'cancelled' packet; an aborted mission may also         │
    │     surface as a signal.aborted error at the controller)       │
    └──────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
    ┌───────────────────────────────────────────────────────────────┐
    │  cancellationManager.unregister(missionId)                     │
    └───────────────────────────────────────────────────────────────┘
```

---

## Context Compaction Flow

```
  tokenUsageRatio = currentTokens / maxContextTokens

  if (tokenUsageRatio > 0.9):

    anchor = messages[0]
    msgsToCompact = messages[1..cutIndex]
    lastTurns = messages[cutIndex..]

    provider.stream([anchor, ...msgsToCompact, compactionPrompt])
      → summaryText

    state.messages = [anchor, summaryMsg, ...lastTurns]
```

---

## Packet Types

+------------------+--------------------------------+------------------------------------------+
| Type             | Description                    | Emitted When                             |
+------------------+--------------------------------+------------------------------------------+
| `metadata`       | Mission lifecycle info         | Start, config, cancellation              |
| `reasoning`      | LLM chain-of-thought           | Per token stream                         |
| `content`        | Text output for user           | Per token stream                         |
| `tool_call`      | Tool invocation request        | Before execution                         |
| `tool_result`    | Tool execution output          | After execution                          |
| `tool_skip`      | Skipped tool (circuit open)    | Circuit breaker open                     |
| `usage`          | Token counts + cost            | Per iteration                            |
| `debug`          | Raw system prompt + history    | If DEBUG_PROMPT                          |
| `todo`           | Task plan update               | write_todos called                       |
| `subagent_call`  | Sub-agent spawning             | delegate_task called                     |
| `subagent_result`| Sub-agent completion           | delegate_task returns                    |
| `state_change`   | Agent state transition         | Status machine transition                |
| `degraded`       | Degradation signal             | Strategy degraded                        |
| `progress`       | Token usage progress           | After tool execution                     |
| `heartbeat`      | Keepalive + status             | 5s during stream inactivity              |
| `turn_complete`  | Turn finished                  | End of mission loop                      |
| `system_notice`  | System-level notice            | Budget/loop warnings                     |
| `hitl_approval_required` | HITL approval request  | Protected tool call                     |
| `error`          | Execution error                | Failure paths                            |
+------------------+--------------------------------+------------------------------------------+

`swarm_status` is NOT emitted — it is a legacy type retained in client
unions.

---

## Entry Points & Exports

+-----------------------+--------------------------------+--------------------------------------------+
| Export                | Source                         | Type                                       |
+-----------------------+--------------------------------+--------------------------------------------+
| `NlahHarness`         | `harness.ts:43`                | Primary harness implementation (instantiated directly by the mission controller — there is no facade) |
| `HarnessConfig`       | `types.ts`                     | Configuration interface                    |
| `HarnessRuntimeConfig`| `types.ts`                     | Runtime overrides (circuit breaker, degradation, agent status) |
| `DEFAULT_HARNESS_TOGGLES` | `types.ts`                | Default feature toggle values              |
| `cancellationManager` | `cancel_manager.ts`            | Singleton                                  |
| `HARNESS_CONFIG`      | `constants.ts`                 | Core constants                             |
+-----------------------+--------------------------------+--------------------------------------------+

> `AgentHarness`, `HarnessFactory`, and `IAgentHarness` do NOT exist — the
> mission controller constructs `new NlahHarness(...)` directly.

---

## Dependencies

+----------------------------------+--------------------------------------------------------------+
| Dependency                       | Purpose                                                      |
+----------------------------------+--------------------------------------------------------------+
| `@langchain/core/messages`       | `HumanMessage`, `AIMessage`, `ToolMessage`                  |
| `shared/types`                   | `LLMProvider`, `AgentStrategy`, `AgentState`, `ToolDefinition`|
| `toolRegistry`                   | Tool resolution without explicit binding                     |
| `ToolRetriever`                  | Relevance-based tool selection                               |
| `stateStorage`                   | State persistence after each iteration                       |
| `cancellationManager`            | Abort signal for client disconnect                           |
| `startAgentTrace`/`langfuseStorage` | Observability + tracing                                  |
| `@opentelemetry/api`             | OpenTelemetry context propagation                            |
| `shared/utils/harness`           | Cosine similarity, token counting, truncation                |
+----------------------------------+--------------------------------------------------------------+

---

## Source References

+--------------------------+------------------------------------------+-------------------------------------------------------+
| Ref                      | File                                     | Key Lines                                             |
+--------------------------+------------------------------------------+-------------------------------------------------------+
| Main loop                | `harness.ts:832-1131`                | `while (!isComplete && iteration < maxIterations)`    |
| Provider stream          | `harness.ts:490-584`                | Iterates event stream, dispatches by type             |
| Native tool call         | `harness.ts:586-703`                | O(1) map lookup, execute, emit                        |
| Soft recovery (XML)      | `harness.ts:705-767`                | `parseXmlToolCall` (harness.ts:713) — legacy `<function=…>` + generic `<N>…</N>`/`<N/>`/bare tags; rerouted to tool execution, never final content |
| XML tool parser          | `harness/xml_tool_parser.ts:60-89`  | `parseXmlToolCall` — first match in document order; JSON body, malformed → `{}` |
| Content sanitizer        | `harness/content_sanitizer.ts`      | `ContentSanitizer` — strips fake tool traces (`<write_todos>`), DSML `<invoke>` blocks, and echoed `<user_objective>` tags from streamed content chunks BEFORE emit (chunk-boundary safe, buffers partial tags; trailing partials are held across chunks with a `MAX_HOLD_LENGTH` bound and the flush only strips partials matching known tool names, so legitimate `<` in code is preserved); flush on stream end |
| Tier 2 stuck check       | `harness.ts:279-300`                | LLM classifier, feedback prompt                       |
| Pacing threshold         | `harness.ts:885-890`                | Iteration > 5 → force synthesis                       |
| Context compaction       | `harness.ts:419-466`                | Token ratio > 90% → summarize                         |
| Financial abort          | `harness.ts:892-912`                | Cost >= cap → state 'aborted', isComplete (no throw)  |
| Cosine similarity        | `harness.ts:943-954`                | Threshold 0.92 → loop warning                         |
| Tool selection at start  | `harness.ts:314-359`                | explicitTools !== undefined → use as-is (even []), else ToolRetriever; skills filter (338-344) + boundTools filter (346-355) |
| Bound-tools filter       | `harness.ts:346-355`                | `applyBoundTools(tools, behaviorPrompt.boundTools)` — empty = no filter |
| Behavior prompt config   | `harness/types.ts:32-44`            | `HarnessConfig.behaviorPrompt` (optional)             |
| Behavior prompt plumbing | `harness.ts:51,77,361-372`          | Stored in ctor; passed to `strategy.buildSystemPrompt(state, tools, behaviorPrompt)` |
| HITL snapshot            | `harness.ts:1007-1019`              | `harnessSnapshot.behaviorPrompt` — restored on HITL resume (controller re-applies bound filter) |
| Cancel check             | `harness.ts:374-381`                | Checks `cancellationManager.isAborted()`               |
| Harness config           | `constants.ts`                      | MAX_ITERATIONS: 15, COMPACTION_RATIO: 0.9, etc.       |
+--------------------------+------------------------------------------+-------------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
