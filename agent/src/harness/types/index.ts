import { z } from 'zod';
import { BaseMessage } from '@langchain/core/messages';

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
    type: 'tool_call' | 'finish' | 'plan_update';
    toolName?: string;
    toolInput?: Record<string, unknown>;
    content?: string;
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
    execute: (input: any) => Promise<Observation>;
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
        reasoningTokens?: number;
    };
}

/**
 * Abstract interface for LLM communication.
 * ONE method: stream. The stream carries everything — text, reasoning, and tool calls.
 */
export interface LLMProvider {
    stream(
        messages: BaseMessage[],
        tools: ToolDefinition[],
        systemPrompt: string
    ): AsyncIterable<ProviderEvent>;
}
