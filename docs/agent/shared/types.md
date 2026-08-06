================================================================================
  Types - TypeScript Type Definitions for the Agent Service
================================================================================
  Module    : Types
  Service   : agent
  Version   : 1.1
  Updated   : 2026-07-31 (planned: strategy registry types)
================================================================================

## Description

All shared TypeScript interfaces and types used across the agent service are
defined in `src/shared/types/index.ts`. These cover the domain model (missions,
agents, tools), infrastructure contracts (state store, task queue, sandbox), and
the streaming protocol (provider events, harness packets).

---

## File Structure

```
src/shared/types/
  index.ts       # All type definitions (~323 lines)
```

---

## Domain Types

### TenantContext

```typescript
interface TenantContext {
  tenantId: string;      // Enterprise account partition ('local' for desktop)
  userId: string;        // Triggering user identity
  orgId: string;         // Billing organization partition
}
```

### MissionPayload

```typescript
interface MissionPayload {
  missionId: string;
  tenant: TenantContext;
  prompt: string;
  strategy: 'standard' | 'agent'; // frontend sends 'agent'; preprocessor maps 'react'|'nlah'|'deep-research'|'sequential' to 'agent'
}
```

### AgentState

```typescript
interface AgentState {
  missionId: string;
  objective: string;
  tasks: Task[];
  currentTaskId?: string;
  memory: Record<string, unknown>;
  messages: BaseMessage[];         // LangChain BaseMessage[]
}
```

### Task

```typescript
interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed';
  observation?: string;
}
```

<!-- Action interface removed — not present in actual shared/types/index.ts -->

---

## Streaming Protocol Types

### AgentPacketType

```typescript
type AgentPacketType =
  | 'metadata'      // Lifecycle markers
  | 'reasoning'     // Agent thought stream
  | 'content'       // Plain text outputs
  | 'tool_call'     // Tool invocation request
  | 'tool_result'   // Tool execution result
  | 'tool_skip'     // Skipped tool call due to circuit breaker
  | 'error'         // Execution exceptions
  | 'checkpoint'    // State recovery marker
  | 'usage'         // Token usage stats
  | 'todo'          // Task list updates
  | 'subagent_call'
  | 'subagent_result'
  | 'swarm_status'
  | 'debug'
  | 'state_change'  // Agent state transitions
  | 'degraded'      // Strategy degradation signal
  | 'progress'      // Checkpoint progress updates
  | 'heartbeat'     // Live connection heartbeat with status
  | 'turn_complete' // Final packet for turn commit
  | 'system_notice' // System-level notices (budget, loop warnings)
  | 'token_metrics' // Token usage metrics packet
  | 'hitl_approval_required' // Human-in-the-loop approval request
  | 'mission_completed';     // Mission finished payload
```

### HarnessPacket (Discriminated Union)

`HarnessPacket` is a discriminated union — every type has a well-defined shape
with FLAT fields (no `meta:` wrapper):

```typescript
interface HarnessPacketBase {
  missionId: string;
  step: number;
  seq: number;
  timestamp: number;
  agentStatus?: AgentStatus;
}

type HarnessPacket =
  | (HarnessPacketBase & { type: 'metadata'; content?: string; strategy?: string; historyDepth?: number; toolsAvailable?: string[]; objective?: string; maxIterations?: number; title?: string; summary?: string; })
  | (HarnessPacketBase & { type: 'reasoning'; content: string; })
  | (HarnessPacketBase & { type: 'content'; content: string; })
  | (HarnessPacketBase & { type: 'tool_call'; toolName: string; toolInput: Record<string, unknown>; })
  | (HarnessPacketBase & { type: 'tool_result'; toolName: string; content: string; toolResult?: unknown; })
  | (HarnessPacketBase & { type: 'tool_skip'; toolName: string; })
  | (HarnessPacketBase & { type: 'todo'; todos: Array<{ id: string; description: string; status: string }>; })
  | (HarnessPacketBase & { type: 'subagent_call'; subagent: { name, instruction, status: 'calling' }; })
  | (HarnessPacketBase & { type: 'subagent_result'; subagent: { name, instruction, result, status }; })
  | (HarnessPacketBase & { type: 'usage'; usage: TokenUsage; })
  | (HarnessPacketBase & { type: 'progress'; phase: string; tokensUsed: number; tokensTotal: number; })
  | (HarnessPacketBase & { type: 'heartbeat'; })
  | (HarnessPacketBase & { type: 'state_change'; from: string; to: string; reason: string; })
  | (HarnessPacketBase & { type: 'degraded'; from: string; to: string; reason: string; })
  | (HarnessPacketBase & { type: 'turn_complete'; completed: boolean; totalIterations: number; totalCost: number; })
  | (HarnessPacketBase & { type: 'debug'; rawSystemPrompt: string; currentHistoryLength: number; rawMessages: Array<{role, content}>; })
  | (HarnessPacketBase & { type: 'error'; content: string; code?: string; })
  | (HarnessPacketBase & { type: 'swarm_status'; swarm: Record<string, unknown>; })
  | (HarnessPacketBase & { type: 'system_notice'; payload: { level: 'info' | 'warning' | 'error'; code: string; message: string }; })
  | (HarnessPacketBase & { type: 'token_metrics'; payload: { promptTokens, completionTokens, totalTokens, cachedTokens?, estimatedCostUsd }; })
  | (HarnessPacketBase & { type: 'hitl_approval_required'; payload: { approvalId, toolName, args, riskLevel, expiresAt }; })
  | (HarnessPacketBase & { type: 'mission_completed'; payload: { completed: boolean; totalSteps: number; totalCostUsd: number; durationMs: number }; });
```

### FailedUrl

```typescript
interface FailedUrl {
  url: string;
  reason: string;
}
```

---

## Provider Types

### LLMProvider

```typescript
interface LLMProvider {
  modelName?: string;
  baseURL?: string;
  maxContextTokens?: number;
  supportsMultimodal?: boolean;
  stream(
    messages: BaseMessage[],
    tools: ToolDefinition[],
    systemPrompt: string
  ): AsyncIterable<ProviderEvent>;
  cleanupReasoning?(): Promise<void>;
  validate?(): Promise<void>;   // optional pre-flight connectivity check
}
```

The `LLMProvider` interface defines the **single entry point** for all LLM
communication. The `stream()` method is an async generator that yields
`ProviderEvent` objects carrying content, reasoning, tool calls, and usage
statistics.

### ProviderEvent

```typescript
interface ProviderEvent {
  content?: string;
  reasoning?: string;
  id?: string;
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens?: number;
    reasoningTokens?: number;
  };
}
```

---

## Agent & Tool Types

### AgentStrategy

```typescript
interface AgentStrategy {
  name: string;
  buildSystemPrompt(state: AgentState, tools: ToolDefinition[]): string;
}
```

The strategy is responsible **only** for constructing the system prompt. The
harness drives all loop logic.

### Strategy Registry Types `[Active]`


```typescript
type StrategyStatus = 'active' | 'deprecated';

interface StrategyVersionInfo {
  version: string;              // "nlah:v1"
  status: StrategyStatus;
  aliases: string[];
}

interface StrategyRegistryEntry {
  name: string;                 // "nlah"
  versions: StrategyVersionInfo[];
}

interface StrategyRegistry {
  list(): StrategyRegistryEntry[];
  resolve(version: string): AgentStrategy;   // "nlah:v1" -> factory
  isDeprecated(version: string): boolean;
}
```

Catalog shape is shared with `GET /api/strategies` and merged with gateway
rollout at `GET /api/v1/strategies` (see `docs/shared/patterns/strategy-lifecycle.md`).

### ToolDefinition

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  execute: (input: unknown, config?: unknown) => Promise<Observation>;
  keywords?: string[];
}
```

### Observation

```typescript
interface Observation<T = unknown> {
  status: 'success' | 'warning' | 'error';
  summary: string;
  data?: T;
  artifacts?: string[];
  error?: string;
}
```

---

## Dependencies

+----------------------------------+--------------------------------------------------------------+
| Dependency                       | Usage                                                        |
+----------------------------------+--------------------------------------------------------------+
| `zod`                            | Schema type for `ToolDefinition.schema`                     |
| `@langchain/core/messages`       | `BaseMessage` used in `AgentState.messages`                  |
+----------------------------------+--------------------------------------------------------------+

---

## Source References

+----------------------------------+-----------------------------+---------------------------------------------------+
| File                             | Line                        | Description                                       |
+----------------------------------+-----------------------------+---------------------------------------------------+
| `shared/types/index.ts`          | 56-60                       | `TenantContext`                                   |
| `shared/types/index.ts`          | 62-67                       | `MissionPayload`                                  |
| `shared/types/index.ts`          | 69-92                       | `AgentPacketType` union                            |
| `shared/types/index.ts`          | 112-193                     | `HarnessPacket`                                   |
| `shared/types/index.ts`          | 198-204                     | `Observation`                                     |
| `shared/types/index.ts`          | 209-216                     | `AgentState`                                      |
| `shared/types/index.ts`          | 237-242                     | `Task`                                            |
| `shared/types/index.ts`          | 248-251                     | `AgentStrategy`                                   |
| `shared/types/index.ts`          | 253-270                     | `StrategyStatus`, `StrategyVersionInfo`,          |
|                                  |                             | `StrategyRegistryEntry`, `StrategyRegistry`       |
| `shared/types/index.ts`          | 275-281                     | `ToolDefinition`                                  |
| `shared/types/index.ts`          | 287-304                     | `ProviderEvent`                                   |
| `shared/types/index.ts`          | 310-323                     | `LLMProvider` interface                           |
+----------------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
