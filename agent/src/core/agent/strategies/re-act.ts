import { AgentStrategy, AgentState, ToolDefinition } from '../../../shared/types';

/**
 * ReAct (Reasoning and Acting) Strategy.
 * [LEGACY / REFERENCE ONLY]
 * 
 * Re-Act strategy is kept as a lesson/reference pattern for comparison.
 * In production, NLAH (Natural-Language Agent Harness) is the standard coordinator.
 * 
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

        return `<agent_config>
You are Echo, an autonomous ReAct executor. Solve the objective step-by-step.

<objective>
${state.objective}
</objective>

<available_tools>
${toolDescriptions}
</available_tools>

<rules>
1. THOUGHT: Reason directly about the next required step. Max 2 sentences. No fluff.
2. TOOL CALL: If external data or action is needed, call exactly ONE tool immediately.
3. FINAL ANSWER: If data is sufficient, output final answer directly. Stop execution.
4. If a tool fails (e.g. 403 Forbidden), adapt strategy and try an alternative tool. Do not repeat failed inputs.
</rules>
</agent_config>`;
    }
}
