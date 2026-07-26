================================================================================
  Agent Harness - Core Execution Loop
================================================================================
  Module    : Agent Execution Harness
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
================================================================================

## Description

Core execution loop for running agent missions. The NLAH harness (internal
driver for Iterative Agent mode) drives iterations: streaming LLM responses,
detecting tool calls, executing tools,
auto-recovering from failures, and managing context window via compaction.

---

## File Structure

```
harness/
  index.ts                   # AgentHarness facade → delegates to factory
  types.ts                   # HarnessConfig, AgentHarness interface
  factory.ts                 # HarnessFactory.create()
  cancel_manager.ts          # AbortController-based cancellation (singleton)
  nlah/
    harness.ts               # NlahHarness — primary execution loop
    constants.ts             # HARNESS_CONFIG, PACKET_TYPES
    prompts.ts               # System prompts for compaction, recovery, stuck
    utils/
      debug.ts               # Async prompt ledger writer
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
  │  │  3. Check COMPACTION_RATIO (>80% context window)                │  │
  │  │     → Compact: anchor + summary + last N turns                  │  │
  │  │                                                                 │  │
  │  │  4. Debug gates: queuePromptDebug() if DEBUG_PROMPT             │  │
  │  │                                                                 │  │
  │  │  5. provider.stream(messages, tools, systemPrompt)              │  │
  │  │     → reasoning → emit REASONING                               │  │
  │  │     → content   → emit CONTENT                                 │  │
  │  │     → toolCall  → pendingToolCall                              │  │
  │  │     → usage     → emit USAGE, check FINANCIAL_ABORT            │  │
  │  │                                                                 │  │
  │  │  6. Check cosine similarity (loop detection)                    │  │
  │  │     If >= 0.92: inject repeating warning                        │  │
  │  │                                                                 │  │
  │  │  7. Tool Resolution (3 paths):                                  │  │
  │  │     Path 1: Native toolCall → execute → emit tool               │  │
  │  │     Path 2: XML <tool_call>  → Soft Recovery                    │  │
  │  │     Path 3: No tool detected  → Tier 2 Stuck Check              │  │
  │  │                                                                 │  │
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
    │    → harness catches → emits 'cancelled' → breaks loop        │
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
| `metadata`       | Mission lifecycle info         | Start, config                            |
| `reasoning`      | LLM chain-of-thought           | Per token stream                         |
| `content`        | Text output for user           | Per token stream                         |
| `tool_call`      | Tool invocation request        | Before execution                         |
| `tool_result`    | Tool execution output          | After execution                          |
| `usage`          | Token counts + cost            | Per iteration                            |
| `debug`          | Raw system prompt + history    | If DEBUG_PROMPT                          |
| `todo`           | Task plan update               | write_todos called                       |
| `subagent_call`  | Sub-agent spawning             | delegate_task called                     |
| `subagent_result`| Sub-agent completion           | delegate_task returns                    |
| `swarm_status`   | Deep research status           | Per swarm phase                          |
+------------------+--------------------------------+------------------------------------------+

---

## Entry Points & Exports

+-----------------------+--------------------------------+--------------------------------------------+
| Export                | Source                         | Type                                       |
+-----------------------+--------------------------------+--------------------------------------------+
| `AgentHarness`        | `index.ts`                     | Facade class                              |
| `HarnessFactory`      | `factory.ts`                   | `create(type, options)`                    |
| `HarnessConfig`       | `types.ts`                     | Configuration interface                    |
| `IAgentHarness`       | `types.ts`                     | `runMission()` interface                   |
| `cancellationManager` | `cancel_manager.ts`            | Singleton                                  |
| `NlahHarness`         | `nlah/harness.ts`              | Primary harness implementation             |
+-----------------------+--------------------------------+--------------------------------------------+

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
| `utils/harness`                  | Cosine similarity, token counting, truncation                |
+----------------------------------+--------------------------------------------------------------+

---

## Source References

+--------------------------+------------------------------------------+-------------------------------------------------------+
| Ref                      | File                                     | Key Lines                                             |
+--------------------------+------------------------------------------+-------------------------------------------------------+
| Main loop                | `nlah/harness.ts:150-548`                | `while (!isComplete && iteration < maxIterations)`    |
| Provider stream          | `nlah/harness.ts:264-307`                | Iterates event stream, dispatches by type             |
| Native tool call         | `nlah/harness.ts:346-457`                | O(1) map lookup, execute, emit                        |
| Soft recovery (XML)      | `nlah/harness.ts:459-492`                | Regex parse `<function>` + `<parameter>`              |
| Tier 2 stuck check       | `nlah/harness.ts:496-516`                | LLM classifier, feedback prompt                       |
| Pacing threshold         | `nlah/harness.ts:177-184`                | Iteration > 5 → force synthesis                       |
| Context compaction       | `nlah/harness.ts:191-237`                | Token ratio > 90% → summarize                         |
| Financial abort          | `nlah/harness.ts:301-305`                | Cost >= $1.00 → throw                                 |
| Cosine similarity        | `nlah/harness.ts:309-318`                | Threshold 0.92 → loop warning                         |
| Tool selection at start  | `nlah/harness.ts:122-131`                | explicitTools !== undefined → use as-is (even []), else ToolRetriever |
| Cancel check             | `nlah/harness.ts:151-157`                | Checks `cancellationManager.isAborted()`               |
| Harness config           | `nlah/constants.ts`                      | MAX_ITERATIONS: 15, COMPACTION_RATIO: 0.9, etc.       |
+--------------------------+------------------------------------------+-------------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
