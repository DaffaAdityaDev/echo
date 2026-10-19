import { AIMessage, type BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * History entries carry no tool_call metadata, so a tool result cannot be paired
 * with the AI tool_use that produced it. Providers (Anthropic in particular)
 * reject tool_use blocks for undeclared tools, so the result is replayed as text.
 */
export const HISTORY_TOOL_RESULT_PREFIX = "[Tool result]\n";

/**
 * Reconstructs LangChain Message objects from raw API message history.
 */
export function mapHistoryToMessages(history?: Array<{ role: string; content: string }>): BaseMessage[] {
  if (!history) return [];

  return history.map((m) => {
    const role = m.role.toLowerCase();

    if (role === "user" || role === "human") return new HumanMessage(m.content);

    if (role === "system") return new SystemMessage(m.content);

    if (role === "tool_result" || role === "tool") return new HumanMessage(HISTORY_TOOL_RESULT_PREFIX + m.content);

    return new AIMessage(m.content);
  });
}
