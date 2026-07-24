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
  | 'metadata'
  | 'reasoning'
  | 'content'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | 'checkpoint'
  | 'usage'
  | 'todo'
  | 'subagent_call'
  | 'subagent_result'
  | 'swarm_status'
  | 'debug'
  | 'tool_skip'
  | 'degraded'
  | 'state_change'
  | 'progress'
  | 'heartbeat'
  | 'turn_complete';

export interface FailedUrl {
  url: string;
  reason: string;
}

export interface AgentStatus {
  state: 'starting' | 'running' | 'stalled' | 'looping' | 'degraded' | 'completed' | 'aborted';
  step: number;
  maxSteps: number;
  strategy: 'agent' | 'standard' | 'restricted';
  lastActivity: string;
  currentTool?: string;
  currentThought?: string;
  consecutiveFailures?: number;
  activeCircuitBreakers?: string[];
  throughput?: number;
}

interface HarnessPacketBase {
  missionId: string;
  step: number;
  seq: number;
  timestamp: number;
  agentStatus?: AgentStatus;
}

export type HarnessPacket =
  | (HarnessPacketBase & { type: 'metadata'; content?: string; strategy?: string; historyDepth?: number; toolsAvailable?: string[]; objective?: string; maxIterations?: number; title?: string; summary?: string; })
  | (HarnessPacketBase & { type: 'reasoning'; content: string; })
  | (HarnessPacketBase & { type: 'content'; content: string; })
  | (HarnessPacketBase & { type: 'tool_call'; toolName: string; toolInput: Record<string, unknown>; })
  | (HarnessPacketBase & { type: 'tool_result'; toolName: string; content: string; toolResult?: unknown; })
  | (HarnessPacketBase & { type: 'tool_skip'; toolName: string; })
  | (HarnessPacketBase & { type: 'todo'; todos: Array<{ id: string; description: string; status: string }>; })
  | (HarnessPacketBase & { type: 'subagent_call'; subagent: { name: string; instruction: string; status: 'calling'; }; })
  | (HarnessPacketBase & { type: 'subagent_result'; subagent: { name: string; instruction: string; result: string; status: 'completed' | 'failed'; }; })
  | (HarnessPacketBase & { type: 'usage'; usage: { promptTokens: number; completionTokens: number; totalTokens: number; cachedTokens?: number; reasoningTokens?: number; }; })
  | (HarnessPacketBase & { type: 'progress'; phase: string; tokensUsed: number; tokensTotal: number; })
  | (HarnessPacketBase & { type: 'heartbeat'; })
  | (HarnessPacketBase & { type: 'state_change'; from: string; to: string; reason: string; })
  | (HarnessPacketBase & { type: 'degraded'; from: string; to: string; reason: string; })
  | (HarnessPacketBase & { type: 'turn_complete'; completed: boolean; totalIterations: number; totalCost: number; })
  | (HarnessPacketBase & { type: 'debug'; rawSystemPrompt: string; currentHistoryLength: number; rawMessages: Array<{ role: string; content: string }>; })
  | (HarnessPacketBase & { type: 'error'; content: string; code?: string; })
  | (HarnessPacketBase & { type: 'swarm_status'; swarm: Record<string, unknown>; });

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
    supportsMultimodal?: boolean;
    stream(
        messages: BaseMessage[],
        tools: ToolDefinition[],
        systemPrompt: string
    ): AsyncIterable<ProviderEvent>;
    cleanupReasoning?(): Promise<void>;
    /**
     * Optional pre-flight connectivity check.
     * Called before the SSE stream starts so failures return a proper HTTP error
     * instead of an empty/broken stream.
     */
    validate?(): Promise<void>;
}
