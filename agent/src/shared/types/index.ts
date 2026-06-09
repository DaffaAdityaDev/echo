import { z } from 'zod';
import { BaseMessage } from '@langchain/core/messages';

export interface TenantContext {
  tenantId: string;      // Enterprise account partition (Use 'local' for desktop)
  userId: string;        // Triggering user identity
  orgId: string;         // Billing organization partition
}

export interface MissionPayload {
  missionId: string;
  tenant: TenantContext;
  prompt: string;
  strategy: 'react' | 'sequential' | 'standard';
  provider: 'openai' | 'anthropic' | 'gemini-local';
}

export type AgentPacketType = 
  | 'metadata'        // Lifecycle markers (Engine start, setup steps)
  | 'reasoning'       // Agent thought stream
  | 'content'         // Plain text outputs directed to human clients
  | 'tool_call'       // Requesting execution of an infrastructure tool
  | 'tool_result'     // Output retrieved from the sandbox run
  | 'error'           // Execution step exceptions
  | 'checkpoint'      // Persistent state recovery marker
  | 'usage'
  | 'todo'
  | 'subagent_call'
  | 'subagent_result'
  | 'file_operation'
  | 'debug';

export interface HarnessPacket {
  type: AgentPacketType;
  missionId: string;
  step: number;
  content?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolResult?: any;
  meta?: Record<string, any>;
  timestamp: number;
  todos?: Array<{ id: string; description: string; status: string }>;
  subagent?: {
    name: string;
    instruction: string;
    result?: string;
    status: 'calling' | 'completed' | 'failed';
  };
  fileOp?: {
    operation: 'write' | 'read' | 'offload';
    path: string;
    preview?: string;
  };
}

// Infrastructure Adapter Contracts
export interface IStateStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}

export interface ITaskQueue {
  enqueue(payload: MissionPayload): Promise<void>;
}

export interface ISandboxExecutor {
  execute(command: string, tenantId: string): Promise<{ stdout: string; stderr: string; code: number }>;
}

/**
 * Standardized response from any tool call.
 */
export interface Observation<T = unknown> {
    status: 'success' | 'warning' | 'error';
    summary: string;
    data?: T;
    artifacts?: string[];
    error?: string;
}

/**
 * Represents a decision made by the agent's strategy.
 * Used when the stream signals a tool invocation.
 */
export interface Action {
    type: 'tool_call' | 'finish' | 'plan_update' | 'complete';
    toolName?: string;
    toolInput?: Record<string, unknown>;
    content?: string;
    result?: string;
}

/**
 * The internal state of the agent mission.
 */
export interface AgentState {
    missionId: string;
    objective: string;
    tasks: Task[];
    currentTaskId?: string;
    memory: Record<string, unknown>;
    messages: BaseMessage[];
}

export interface Task {
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'done' | 'failed';
    observation?: string;
}

/**
 * Strategy interface — responsible only for constructing the system prompt.
 * The harness drives all loop logic.
 */
export interface AgentStrategy {
    name: string;
    buildSystemPrompt(state: AgentState, tools: ToolDefinition[]): string;
}

/**
 * Contract for tool definitions.
 */
export interface ToolDefinition {
    name: string;
    description: string;
    schema: z.ZodObject<any>;
    execute: (input: any, config?: any) => Promise<Observation>;
    keywords?: string[];
}

/**
 * A single event emitted by the provider's streaming call.
 * Can carry content, reasoning tokens, tool calls, OR usage stats.
 */
export interface ProviderEvent {
    content?: string;
    reasoning?: string;
    id?: string;
    /** When set, the model wants to invoke a tool instead of replying. */
    toolCall?: {
        name: string;
        args: Record<string, unknown>;
    };
    /** Token usage stats from the final chunk — emitted once after stream ends */
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cachedTokens?: number;
        reasoningTokens?: number;
    };
}

/**
 * Abstract interface for LLM communication.
 * ONE method: stream. The stream carries everything — text, reasoning, and tool calls.
 */
export interface LLMProvider {
    modelName?: string;
    baseURL?: string;
    maxContextTokens?: number;
    stream(
        messages: BaseMessage[],
        tools: ToolDefinition[],
        systemPrompt: string
    ): AsyncIterable<ProviderEvent>;
}
