import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { mapHistoryToMessages } from "../messages";

describe("mapHistoryToMessages", () => {
  test("returns an empty array when history is missing", () => {
    expect(mapHistoryToMessages()).toEqual([]);
  });

  test("returns an empty array for empty history", () => {
    expect(mapHistoryToMessages([])).toEqual([]);
  });

  test("maps user role to HumanMessage", () => {
    const [msg] = mapHistoryToMessages([{ role: "user", content: "hi" }]);
    expect(msg).toBeInstanceOf(HumanMessage);
    expect(msg.content).toBe("hi");
  });

  test("maps human role to HumanMessage", () => {
    const [msg] = mapHistoryToMessages([{ role: "human", content: "hi" }]);
    expect(msg).toBeInstanceOf(HumanMessage);
  });

  test("maps system role to SystemMessage", () => {
    const [msg] = mapHistoryToMessages([{ role: "system", content: "be helpful" }]);
    expect(msg).toBeInstanceOf(SystemMessage);
    expect(msg.content).toBe("be helpful");
  });

  test("maps ai role to AIMessage", () => {
    const [msg] = mapHistoryToMessages([{ role: "ai", content: "hello" }]);
    expect(msg).toBeInstanceOf(AIMessage);
    expect(msg.content).toBe("hello");
  });

  test("maps tool role to a tool call plus ToolMessage", () => {
    const messages = mapHistoryToMessages([{ role: "tool", content: "tool result" }]);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBeInstanceOf(AIMessage);
    const toolCall = (messages[0] as AIMessage).tool_calls?.[0];
    expect(toolCall?.name).toBe("tool");
    expect(messages[1]).toBeInstanceOf(ToolMessage);
    expect((messages[1] as ToolMessage).tool_call_id).toBe(toolCall?.id);
    expect(messages[1].content).toBe("tool result");
  });

  test("maps tool_result role to a tool call plus ToolMessage", () => {
    const messages = mapHistoryToMessages([{ role: "tool_result", content: "output" }]);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBeInstanceOf(AIMessage);
    expect(messages[1]).toBeInstanceOf(ToolMessage);
  });

  test("matches roles case-insensitively", () => {
    const [msg] = mapHistoryToMessages([{ role: "SYSTEM", content: "x" }]);
    expect(msg).toBeInstanceOf(SystemMessage);
  });

  test("maps unknown roles to AIMessage", () => {
    const [msg] = mapHistoryToMessages([{ role: "assistant", content: "sure" }]);
    expect(msg).toBeInstanceOf(AIMessage);
    expect(msg.content).toBe("sure");
  });

  test("passes content through unchanged in order", () => {
    const messages = mapHistoryToMessages([
      { role: "system", content: "a" },
      { role: "user", content: "b" },
      { role: "ai", content: "c" },
    ]);
    expect(messages.map((m) => m.content)).toEqual(["a", "b", "c"]);
  });

  test("handles mixed history with tool entries", () => {
    const messages = mapHistoryToMessages([
      { role: "system", content: "sys" },
      { role: "user", content: "q" },
      { role: "tool", content: "result" },
      { role: "ai", content: "answer" },
    ]);
    expect(messages).toHaveLength(5);
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect(messages[1]).toBeInstanceOf(HumanMessage);
    expect(messages[2]).toBeInstanceOf(AIMessage);
    expect(messages[3]).toBeInstanceOf(ToolMessage);
    expect(messages[4]).toBeInstanceOf(AIMessage);
  });
});
