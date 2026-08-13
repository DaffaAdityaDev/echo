import { AIMessage, type BaseMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

/**
 * Reconstructs LangChain Message objects from raw API message history.
 */
export function mapHistoryToMessages(history?: Array<{ role: string; content: string }>): BaseMessage[] {
  if (!history) return [];
  const result: BaseMessage[] = [];
  let toolCallSeq = 0;
  for (const m of history) {
    const role = m.role.toLowerCase();
    if (role === "user" || role === "human") {
      result.push(new HumanMessage(m.content));
    } else if (role === "system") {
      result.push(new SystemMessage(m.content));
    } else if (role === "tool_result" || role === "tool") {
      toolCallSeq += 1;
      const toolCallId = `prev_tool_${toolCallSeq}`;
      result.push(
        new AIMessage({
          content: "",
          tool_calls: [
            {
              id: toolCallId,
              name: "tool",
              args: {},
              type: "tool_call",
            },
          ],
        }),
      );
      result.push(
        new ToolMessage({
          content: m.content,
          tool_call_id: toolCallId,
        }),
      );
    } else {
      result.push(new AIMessage(m.content));
    }
  }
  return result;
}
