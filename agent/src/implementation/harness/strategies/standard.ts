import { AgentStrategy, AgentState, ToolDefinition } from '../types';

/**
 * Standard Strategy: A simple one-shot chat.
 * Provides a minimal system prompt — the model replies once and finishes.
 */
export class StandardStrategy implements AgentStrategy {
    name = "standard";

    buildSystemPrompt(state: AgentState, tools: ToolDefinition[]): string {
        return `You are Echo, a helpful AI assistant. Answer the user's question directly and concisely.`;
    }
}
