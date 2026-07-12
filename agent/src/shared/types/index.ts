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
  strategy: 'standard' | 'agent';
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
  | 'swarm_status'
  | 'debug'
  | 'tool_skip'       // skipped tool call due to circuit breaker
  | 'degraded'        // strategy degradation signal
  | 'state_change'    // agent state transitions
  | 'progress'        // checkpoint progress updates
  | 'heartbeat'       // live connection heartbeat with status
  | 'turn_complete';  // final packet for turn commit

export interface FailedUrl {
  url: string;
  reason: string;
}

export interface AgentStatus {
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
  swarm?: any;
  failedUrls?: FailedUrl[];
  agentStatus?: AgentStatus;
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
    cleanupReasoning?(): Promise<void>;
}
