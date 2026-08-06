import type { AgentState, AgentStrategy, ToolDefinition } from "../../../shared/types";
import type { BehaviorPrompt } from "../prompts";
import { STRATEGY_NAMES } from "./constants";
import { DEFAULT_NLAH_BEHAVIOR, NLAH_INSTRUCTIONS, NLAH_PROMPTS } from "./prompts";

export const RESEARCH_WORKFLOW_INSTRUCTIONS = NLAH_INSTRUCTIONS.RESEARCH_WORKFLOW;
export const SUBAGENT_DELEGATION_INSTRUCTIONS = NLAH_INSTRUCTIONS.SUBAGENT_DELEGATION;
export const RESEARCHER_INSTRUCTIONS = NLAH_INSTRUCTIONS.RESEARCHER;
export const CODING_INSTRUCTIONS = NLAH_INSTRUCTIONS.CODING;

/**
 * Natural-Language Agent Harness (NLAH) Strategy.
 * [ACTIVE / PRIMARY STANDARD]
 *
 * Dynamically builds system prompts based on active tool capabilities:
 * - COORDINATOR MODE when delegate_task is active.
 * - DIRECT MODE when delegate_task is absent.
 */
export class NLAHStrategy implements AgentStrategy {
  name = STRATEGY_NAMES.AGENT;

  buildSystemPrompt(state: AgentState, tools: ToolDefinition[], behaviorPrompt?: BehaviorPrompt | null): string {
    const sortedTools = [...tools].sort((a, b) => a.name.localeCompare(b.name));
    const toolDescriptions =
      sortedTools.length > 0 ? sortedTools.map((t) => `- ${t.name}: ${t.description}`).join("\n") : "(none)";

    const hasDelegation = tools.some((t) => t.name === "delegate_task");
    const hasTodos = tools.some((t) => t.name === "write_todos");
    const hasWebSearch = tools.some((t) => t.name === "web_search");
    const hasResearchTools = hasDelegation || hasWebSearch;

    const capabilityMode = hasDelegation
      ? "COORDINATOR MODE (active): You act as a stateless coordinator. Delegate execution to specialized sub-agents via delegate_task. Do not perform research or editing directly."
      : "DIRECT MODE (active): No delegation tools are enabled. Answer directly using the tools listed below. If no tools are available at all, respond from your own knowledge — do not attempt tool calls.";

    const protocolLines: string[] = [];
    if (hasDelegation) {
      protocolLines.push(
        "Orchestrator Only: You are prohibited from editing files directly unless synthesizing sub-agent results. Always delegate researcher tasks to sub-agents.",
      );
    }
    if (hasTodos) {
      protocolLines.push(
        "In-State Planning: Start by creating a plan using write_todos. Track progress (pending, in_progress, done, failed).",
      );
    }
    if (hasDelegation) {
      protocolLines.push(
        "Clear Validation: Before finishing, verify that the sub-agents successfully completed their tasks and generated appropriate files.",
      );
    }
    if (hasTodos) {
      protocolLines.push("Durable State: Your state is logged in STATE.md. Ensure write_todos updates this.");
    }
    if (hasResearchTools) {
      protocolLines.push("Evidence-backed: Support every claim with a cited tool result.");
    }

    const coreProtocols =
      protocolLines.length > 0
        ? protocolLines.map((line, idx) => `${idx + 1}. ${line}`).join("\n")
        : "None. Proceed with execution.";

    let workflow = "";
    if (behaviorPrompt?.systemPrompt) {
      let substitutedPrompt = behaviorPrompt.systemPrompt
        .replace(/{tools}/g, () => toolDescriptions)
        .replace(/{objective}/g, () => `<user_objective>${state.objective}</user_objective>`);

      if (!hasDelegation) {
        // Strip SUB-AGENT DELEGATION PROTOCOL block from custom DB prompts when delegation is inactive
        substitutedPrompt = substitutedPrompt
          .replace(/SUB-AGENT DELEGATION PROTOCOL:[\s\S]*?(?=\n\n|\n[A-Z_]+:|$)/gi, "")
          .trim();
      }
      workflow = substitutedPrompt;
    } else if (hasDelegation) {
      workflow = DEFAULT_NLAH_BEHAVIOR;
    } else if (hasTodos) {
      workflow = NLAH_INSTRUCTIONS.PLANNING_WORKFLOW;
    } else {
      workflow = "";
    }

    const completion = hasResearchTools
      ? "COMPLETION CONTRACT:\n- The run is complete ONLY when: (a) the objective is answered, AND (b) each claim cites a tool result or sub-agent finding. Do not finalize without cited evidence."
      : "COMPLETION CONTRACT:\n- The run is complete when you have answered the objective to the best of your ability. No tool citations are required.";

    return NLAH_PROMPTS.SYSTEM_TEMPLATE.replace("{capability_mode}", () => capabilityMode)
      .replace("{core_protocols}", () => coreProtocols)
      .replace("{workflow}", () => workflow)
      .replace("{tools}", () => toolDescriptions)
      .replace("{objective}", () => `<user_objective>${state.objective}</user_objective>`)
      .replace("{completion}", () => completion);
  }
}
