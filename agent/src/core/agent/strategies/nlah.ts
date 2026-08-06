import type { AgentState, AgentStrategy, ToolDefinition } from "../../../shared/types";
import type { BehaviorPrompt } from "../prompts";
import { STRATEGY_NAMES } from "./constants";
import { DEFAULT_NLAH_BEHAVIOR, NLAH_INSTRUCTIONS, NLAH_PROMPTS } from "./prompts";

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
  name = STRATEGY_NAMES.AGENT;

  buildSystemPrompt(state: AgentState, tools: ToolDefinition[], behaviorPrompt?: BehaviorPrompt | null): string {
    const sortedTools = [...tools].sort((a, b) => a.name.localeCompare(b.name));
    const toolDescriptions = sortedTools.map((t) => `- ${t.name}: ${t.description}`).join("\n");

    return NLAH_PROMPTS.SYSTEM_TEMPLATE.replace("{objective}", `<user_objective>${state.objective}</user_objective>`)
      .replace("{tools}", toolDescriptions)
      .replace("{workflow}", behaviorPrompt?.systemPrompt ?? DEFAULT_NLAH_BEHAVIOR)
      .replace("{delegation}", "");
  }
}
