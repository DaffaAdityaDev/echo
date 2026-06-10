import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";

/**
 * Reconstructs LangChain Message objects from raw API message history.
 */
export function mapHistoryToMessages(history?: Array<{ role: string; content: string }>): BaseMessage[] {
  if (!history) return [];
  return history.map((m) => {
    const role = m.role.toLowerCase();
    if (role === 'user' || role === 'human') {
      return new HumanMessage(m.content);
    }
    return new AIMessage(m.content);
  });
}
