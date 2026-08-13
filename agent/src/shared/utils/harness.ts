import type { BaseMessage } from "@langchain/core/messages";

export function getCosineSimilarity(text1: string, text2: string): number {
  const tokenize = (text: string) => {
    return text.toLowerCase().match(/\b\w+\b/g) || [];
  };
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const freq1: Record<string, number> = {};
  const freq2: Record<string, number> = {};
  const allWords = new Set<string>();

  for (const w of tokens1) {
    freq1[w] = (freq1[w] || 0) + 1;
    allWords.add(w);
  }
  for (const w of tokens2) {
    freq2[w] = (freq2[w] || 0) + 1;
    allWords.add(w);
  }

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (const w of allWords) {
    const val1 = freq1[w] || 0;
    const val2 = freq2[w] || 0;
    dotProduct += val1 * val2;
    mag1 += val1 * val1;
    mag2 += val2 * val2;
  }

  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

export function estimateCharTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

export function getHistoryTokens(msgs: BaseMessage[]): number {
  return msgs.reduce((acc, m) => acc + estimateCharTokens((m.content || "").toString()), 0);
}

export function selectiveTruncateToolResults(messages: BaseMessage[], threshold: number): BaseMessage[] {
  return messages.map((msg) => {
    if (msg._getType() === "tool") {
      const contentStr = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      if (contentStr.length > threshold) {
        const ToolMsgClass = msg.constructor as unknown as new (init: {
          content: string;
          name?: string;
          id?: string;
          tool_call_id?: string;
          additional_kwargs?: Record<string, unknown>;
          response_metadata?: Record<string, unknown>;
        }) => BaseMessage;
        return new ToolMsgClass({
          content: `[Tool output truncated: original length ${contentStr.length} chars exceeding threshold ${threshold}]`,
          name: msg.name,
          id: msg.id,
          tool_call_id: (msg as BaseMessage & { tool_call_id?: string }).tool_call_id,
          additional_kwargs: msg.additional_kwargs,
          response_metadata: msg.response_metadata,
        });
      }
    }
    return msg;
  });
}
