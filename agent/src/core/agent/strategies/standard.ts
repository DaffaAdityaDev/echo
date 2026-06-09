import { AgentStrategy, AgentState, ToolDefinition } from '../../../shared/types';

/**
 * Standard Strategy: A simple one-shot chat.
 * [LEGACY / REFERENCE ONLY]
 * 
 * Simple chat strategy kept as a lesson/reference pattern for comparison.
 * In production, NLAH (Natural-Language Agent Harness) is the standard coordinator.
 * 
 * Provides a minimal system prompt — the model replies once and finishes.
 */
export class StandardStrategy implements AgentStrategy {
    name = "standard";

    buildSystemPrompt(state: AgentState, tools: ToolDefinition[]): string {
        return `You are Echo, a helpful AI assistant. Answer the user's question directly and concisely.`;
    }
}
