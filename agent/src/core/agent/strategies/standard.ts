import { AgentStrategy, AgentState, ToolDefinition } from '../../../shared/types';
import { STRATEGY_NAMES } from './constants';
import { STANDARD_PROMPTS } from './prompts';

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
    name = STRATEGY_NAMES.STANDARD;

    buildSystemPrompt(state: AgentState, tools: ToolDefinition[]): string {
        return STANDARD_PROMPTS.STANDARD_SYSTEM;
    }
}
