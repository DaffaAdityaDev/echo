================================================================================
  Types - TypeScript Type Definitions for the Agent Service
================================================================================
  Module    : Types
  Service   : agent
  Version   : 1.0
  Updated   : 2026-07-09
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
  index.ts       # All type definitions (~170 lines)
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
  strategy: 'react' | 'nlah' | 'standard' | 'sequential'; // internal type — frontend sends 'agent' which maps to 'nlah'
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

### Action

```typescript
interface Action {
  type: 'tool_call' | 'finish' | 'plan_update' | 'complete';
  toolName?: string;
  toolInput?: Record<string, unknown>;
  content?: string;
  result?: string;
}
```

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
  | 'turn_complete';// Final packet for turn commit
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
  | (HarnessPacketBase & { type: 'metadata'; content?: string; strategy?: string; historyDepth?: number; toolsAvailable?: string[]; objective?: string; maxIterations?: number; })
  | (HarnessPacketBase & { type: 'reasoning'; content: string; })
  | (HarnessPacketBase & { type: 'content'; content: string; })
  | (HarnessPacketBase & { type: 'tool_call'; toolName: string; toolInput: Record<string, unknown>; })
  | (HarnessPacketBase & { type: 'tool_result'; toolName: string; content: string; toolResult?: unknown; })
  | (HarnessPacketBase & { type: 'tool_skip'; toolName: string; })
  | (HarnessPacketBase & { type: 'todo'; todos: Task[]; })
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
  | (HarnessPacketBase & { type: 'swarm_status'; swarm: Record<string, unknown>; });
```

### FailedUrl

```typescript
interface FailedUrl {
  url: string;
  reason: string;
}
```

---

## Infrastructure Contract Types

### IStateStore

```typescript
interface IStateStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}
```

### ITaskQueue

```typescript
interface ITaskQueue {
  enqueue(payload: MissionPayload): Promise<void>;
}
```

### ISandboxExecutor

```typescript
interface ISandboxExecutor {
  execute(command: string, tenantId: string): Promise<{ stdout: string; stderr: string; code: number }>;
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
  stream(
    messages: BaseMessage[],
    tools: ToolDefinition[],
    systemPrompt: string
  ): AsyncIterable<ProviderEvent>;
  cleanupReasoning?(): Promise<void>;
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

### ToolDefinition

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
  execute: (input: any, config?: any) => Promise<Observation>;
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
| `shared/types/index.ts`          | 4-8                         | `TenantContext`                                   |
| `shared/types/index.ts`          | 10-16                       | `MissionPayload`                                  |
| `shared/types/index.ts`          | 17-30                       | `AgentPacketType` union                            |
| `shared/types/index.ts`          | 37-56                       | `HarnessPacket`                                   |
| `shared/types/index.ts`          | 59-71                       | Infrastructure contracts: IStateStore, ITaskQueue |
| `shared/types/index.ts`          | 76-82                       | `Observation`                                     |
| `shared/types/index.ts`          | 88-94                       | `Action`                                          |
| `shared/types/index.ts`          | 99-106                      | `AgentState`                                      |
| `shared/types/index.ts`          | 108-113                     | `Task`                                            |
| `shared/types/index.ts`          | 119-122                     | `AgentStrategy`                                   |
| `shared/types/index.ts`          | 127-133                     | `ToolDefinition`                                  |
| `shared/types/index.ts`          | 139-156                     | `ProviderEvent`                                   |
| `shared/types/index.ts`          | 162-172                     | `LLMProvider` interface                           |
+----------------------------------+-----------------------------+---------------------------------------------------+

================================================================================
  (c) 2026 Echo - All Rights Reserved
================================================================================
