import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { getCosineSimilarity, getHistoryTokens, selectiveTruncateToolResults, validateContent } from "../harness";

describe("getCosineSimilarity", () => {
  test("identical strings return 1", () => {
    expect(getCosineSimilarity("hello world", "hello world")).toBeCloseTo(1);
  });

  test("is case-insensitive", () => {
    expect(getCosineSimilarity("Hello World", "hello world")).toBeCloseTo(1);
  });

  test("disjoint strings return 0", () => {
    expect(getCosineSimilarity("foo bar", "baz qux")).toBe(0);
  });

  test("partially overlapping strings return a value between 0 and 1", () => {
    const score = getCosineSimilarity("the quick brown fox", "the quick blue dog");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  test("empty input returns 0", () => {
    expect(getCosineSimilarity("", "anything")).toBe(0);
    expect(getCosineSimilarity("anything", "")).toBe(0);
    expect(getCosineSimilarity("", "")).toBe(0);
  });
});

describe("getHistoryTokens", () => {
  test("counts ceil(length / 4) per message", () => {
    const messages = [
      new HumanMessage({ content: "abcd" }),
      new AIMessage({ content: "abcde" }),
      new HumanMessage({ content: "abcdefgh" }),
    ];
    expect(getHistoryTokens(messages)).toBe(1 + 2 + 2);
  });

  test("empty messages contribute zero tokens", () => {
    expect(getHistoryTokens([new HumanMessage({ content: "" })])).toBe(0);
    expect(getHistoryTokens([])).toBe(0);
  });

  test("sums across messages", () => {
    const messages = [new HumanMessage({ content: "a" }), new HumanMessage({ content: "a".repeat(28) })];
    expect(getHistoryTokens(messages)).toBe(1 + Math.ceil(28 / 4));
  });
});

describe("selectiveTruncateToolResults", () => {
  test("long tool message is replaced with truncated content", () => {
    const long = new ToolMessage({ content: "x".repeat(1000), tool_call_id: "call-1", name: "search" });
    const [result] = selectiveTruncateToolResults([long], 100);

    expect(result).not.toBe(long);
    expect(result).toBeInstanceOf(ToolMessage);
    const content = String(result.content);
    expect(content).toContain("[Tool output truncated");
    expect(content).toContain("1000");
    expect(content).toContain("100");
  });

  test("short tool message is unchanged", () => {
    const short = new ToolMessage({ content: "short", tool_call_id: "call-1", name: "search" });
    const [result] = selectiveTruncateToolResults([short], 100);

    expect(result).toBe(short);
    expect(result.content).toBe("short");
  });

  test("long non-tool messages are untouched", () => {
    const human = new HumanMessage({ content: "h".repeat(500) });
    const ai = new AIMessage({ content: "a".repeat(500) });
    const [humanResult, aiResult] = selectiveTruncateToolResults([human, ai], 10);

    expect(humanResult).toBe(human);
    expect(aiResult).toBe(ai);
  });
});

describe("validateContent", () => {
  test("content with placeholder is invalid", () => {
    const result = validateContent("a.txt", "some text with placeholder inside");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("placeholder");
  });

  test("json file with valid JSON is valid", () => {
    expect(validateContent("x.json", '{"a": 1}').valid).toBe(true);
  });

  test("json file with invalid JSON is invalid", () => {
    const result = validateContent("x.json", "{not json}");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Invalid JSON");
  });

  test("ts file with a syntax error is invalid", () => {
    const result = validateContent("x.ts", "const = ;");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Syntax error");
  });

  test("ts file with valid content is valid", () => {
    expect(validateContent("x.ts", "const x = 1;").valid).toBe(true);
  });

  test("unknown extension is valid", () => {
    expect(validateContent("notes.md", "whatever content").valid).toBe(true);
  });
});
