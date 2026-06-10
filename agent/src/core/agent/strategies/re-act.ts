import { AgentStrategy, AgentState, ToolDefinition } from '../../../shared/types';
import { STRATEGY_NAMES } from './constants';
import { REACT_PROMPTS } from './prompts';

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
    name = STRATEGY_NAMES.REACT;

    buildSystemPrompt(state: AgentState, tools: ToolDefinition[]): string {
        const toolDescriptions = tools
            .map(t => `- ${t.name}: ${t.description}`)
            .join('\n');

        return REACT_PROMPTS.REACT_SYSTEM
            .replace('{objective}', state.objective)
            .replace('{tools}', toolDescriptions);
    }
}
