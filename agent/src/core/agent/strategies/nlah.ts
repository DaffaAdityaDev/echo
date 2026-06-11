import { AgentStrategy, AgentState, ToolDefinition } from '../../../shared/types';
import { STRATEGY_NAMES } from './constants';
import { NLAH_INSTRUCTIONS, NLAH_PROMPTS } from './prompts';

export const RESEARCH_WORKFLOW_INSTRUCTIONS = NLAH_INSTRUCTIONS.RESEARCH_WORKFLOW;
export const SUBAGENT_DELEGATION_INSTRUCTIONS = NLAH_INSTRUCTIONS.SUBAGENT_DELEGATION;
export const RESEARCHER_INSTRUCTIONS = NLAH_INSTRUCTIONS.RESEARCHER;

/**
 * Natural-Language Agent Harness (NLAH) Strategy.
 * [ACTIVE / PRIMARY STANDARD]
 * 
 * NLAH is the target orchestration strategy for production.
 * Under this framework, the top-level agent acts solely as a stateless coordinator
 * that delegates tasks to specialized sub-agents rather than performing editing
 * or research actions directly.
 */
export class NLAHStrategy implements AgentStrategy {
    name = STRATEGY_NAMES.NLAH;

    buildSystemPrompt(state: AgentState, tools: ToolDefinition[]): string {
        const sortedTools = [...tools].sort((a, b) => a.name.localeCompare(b.name));
        const toolDescriptions = sortedTools
            .map(t => `- ${t.name}: ${t.description}`)
            .join('\n');

        return NLAH_PROMPTS.SYSTEM_TEMPLATE
            .replace('{objective}', state.objective)
            .replace('{tools}', toolDescriptions)
            .replace('{workflow}', RESEARCH_WORKFLOW_INSTRUCTIONS)
            .replace('{delegation}', SUBAGENT_DELEGATION_INSTRUCTIONS);
    }
}
export default NLAHStrategy;
