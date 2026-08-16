import type { DbMessage, Message, ThoughtStep } from "../types";

export function parseToolCallContent(content: string): { toolName: string; toolInput: Record<string, unknown> } {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null) {
      const rec = parsed as Record<string, unknown>;
      return {
        toolName: typeof rec.toolName === "string" ? rec.toolName : "",
        toolInput:
          typeof rec.toolInput === "object" && rec.toolInput !== null ? (rec.toolInput as Record<string, unknown>) : {},
      };
    }
  } catch {
    // Not JSON: fall through to the safe default.
  }
  return { toolName: "", toolInput: {} };
}

export function groupMessagesByTurn(messages: DbMessage[]): Message[] {
  const turnMap = new Map<number, DbMessage[]>();
  for (const msg of messages) {
    const group = turnMap.get(msg.turn_number) || [];
    group.push(msg);
    turnMap.set(msg.turn_number, group);
  }
  const result: Message[] = [];
  for (const [turnNumber, group] of turnMap) {
    const userMsg = group.find((m) => m.role === "user");
    const assistantMsg = group.find((m) => m.role === "assistant");
    const systemMsg = group.find((m) => m.role === "system");
    if (systemMsg) {
      result.push({
        id: `sys-${turnNumber}-${systemMsg.id}`,
        role: "assistant",
        content: `[System]: ${systemMsg.content}`,
        steps: [],
      });
      continue;
    }
    if (userMsg) {
      result.push({
        id: `user-${turnNumber}-${userMsg.id}`,
        role: "user",
        content: userMsg.content,
        steps: [],
      });
    }
    let steps: ThoughtStep[] = [];
    if (assistantMsg?.steps && assistantMsg.steps.length > 0) {
      steps = assistantMsg.steps;
    } else if (assistantMsg) {
      for (const m of group) {
        if (m.role === "thought") {
          steps.push({ type: "reasoning", content: m.content });
        } else if (m.role === "tool_call") {
          const parsed = parseToolCallContent(m.content);
          steps.push({ type: "tool_call", toolName: parsed.toolName, toolInput: parsed.toolInput });
        } else if (m.role === "tool_result") {
          const colonIdx = m.content.indexOf(" result: ");
          const toolName = colonIdx > 0 ? m.content.substring(0, colonIdx) : "";
          const content = colonIdx > 0 ? m.content.substring(colonIdx + 9) : m.content;
          steps.push({ type: "tool_result", toolName, content });
        }
      }
    }
    const hasSteps = steps.length > 0;
    const hasContent = Boolean(
      assistantMsg?.content ||
        hasSteps ||
        assistantMsg?.status === "streaming" ||
        assistantMsg?.status === "interrupted",
    );
    if (hasContent) {
      result.push({
        id: `asst-${turnNumber}-${assistantMsg?.id || "stream"}`,
        role: "assistant",
        content: assistantMsg?.content || "",
        steps,
        status: assistantMsg?.status,
      });
    }
  }
  return result;
}
