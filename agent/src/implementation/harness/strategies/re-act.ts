import { AgentStrategy, AgentState, ToolDefinition } from '../types';

/**
 * ReAct (Reasoning and Acting) Strategy.
 * Provides a directive system prompt that instructs the model to:
 * 1. Reason internally using the <think> block.
 * 2. Call tools when it needs real-time information.
 * 3. Synthesize a final answer from tool observations.
 */
export class ReActStrategy implements AgentStrategy {
    name = "react";

    buildSystemPrompt(state: AgentState, tools: ToolDefinition[]): string {
        const toolDescriptions = tools
            .map(t => `- ${t.name}: ${t.description}`)
            .join('\n');

        return `You are Echo, an autonomous AI agent. Solve the user's objective step by step.

OBJECTIVE: ${state.objective}

AVAILABLE TOOLS:
${toolDescriptions}

RULES:
1. Use your internal reasoning to plan before acting.
2. If you need real-time or external information, call the appropriate tool.
3. After receiving a tool observation, reason about it and decide your next step.
4. When you have enough information to answer fully, reply with your final answer. Do NOT call any more tools.
5. Be concise and accurate.`;
    }
}
