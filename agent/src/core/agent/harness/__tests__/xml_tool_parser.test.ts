import { hasProtocolMarkup, parseXmlToolCall } from "../xml_tool_parser";

const KNOWN = new Set(["write_todos", "delegate_task", "web_search"]);

describe("parseXmlToolCall", () => {
  test("parses the legacy <function=...> + <parameter=...> form", () => {
    const content = "<function=web_search><parameter=query>\nclimate report\n</parameter></function>";
    expect(parseXmlToolCall(content, KNOWN)).toEqual({ name: "web_search", args: { query: "climate report" } });
  });

  test("coerces boolean parameter values", () => {
    const content = "<function=web_search><parameter=fresh>false</parameter></function>";
    expect(parseXmlToolCall(content, KNOWN)).toEqual({ name: "web_search", args: { fresh: false } });
  });

  test("parses <write_todos>...</write_todos> with a JSON body", () => {
    const content = '<write_todos>{"todos":[{"id":"1","task":"plan","status":"pending"}]}</write_todos>';
    expect(parseXmlToolCall(content, KNOWN)).toEqual({
      name: "write_todos",
      args: { todos: [{ id: "1", task: "plan", status: "pending" }] },
    });
  });

  test("parses <delegate_task>...</delegate_task> into args", () => {
    const content = '<delegate_task>{"agentName":"researcher","instruction":"find docs"}</delegate_task>';
    expect(parseXmlToolCall(content, KNOWN)).toEqual({
      name: "delegate_task",
      args: { agentName: "researcher", instruction: "find docs" },
    });
  });

  test("degrades malformed JSON to empty args", () => {
    const content = "<write_todos>not json at all</write_todos>";
    expect(parseXmlToolCall(content, KNOWN)).toEqual({ name: "write_todos", args: {} });
  });

  test("degrades brace-wrapped but unparseable bodies to empty args", () => {
    const content = "<delegate_task>{a: 1}</delegate_task>";
    expect(parseXmlToolCall(content, KNOWN)).toEqual({ name: "delegate_task", args: {} });
  });

  test("returns null for unknown tags", () => {
    expect(parseXmlToolCall("<tool_call>foo</tool_call>", KNOWN)).toBeNull();
    expect(parseXmlToolCall("<unknown_tool>x</unknown_tool>", KNOWN)).toBeNull();
  });

  test("returns null for plain content without XML", () => {
    expect(parseXmlToolCall("Here is the final answer.", KNOWN)).toBeNull();
  });

  test("parses self-closing tags to empty args", () => {
    expect(parseXmlToolCall("<write_todos/>", KNOWN)).toEqual({ name: "write_todos", args: {} });
  });

  test("parses a bare opening tag without a closing tag to empty args", () => {
    expect(parseXmlToolCall("I will plan: <write_todos> then continue", KNOWN)).toEqual({
      name: "write_todos",
      args: {},
    });
  });

  test("prefers <function=...> over a generic known tag", () => {
    const content =
      '<delegate_task>{"agentName":"x"}</delegate_task><function=web_search><parameter=query>q</parameter></function>';
    expect(parseXmlToolCall(content, KNOWN)).toEqual({ name: "web_search", args: { query: "q" } });
  });

  test("returns the first known-tag match in document order", () => {
    const content = '<delegate_task>{"agentName":"a"}</delegate_task> then <write_todos>{}</write_todos>';
    expect(parseXmlToolCall(content, KNOWN)?.name).toBe("delegate_task");
  });

  test("matches tool names case-sensitively", () => {
    expect(parseXmlToolCall("<WRITE_TODOS>{}</WRITE_TODOS>", KNOWN)).toBeNull();
  });
});

describe("hasProtocolMarkup", () => {
  test("flags generic protocol tags", () => {
    expect(hasProtocolMarkup("use <tool_call>foo</tool_call> now", KNOWN)).toBe(true);
    expect(hasProtocolMarkup("</tool_call> leaked", KNOWN)).toBe(true);
    expect(hasProtocolMarkup('<parameter name="query">x</parameter>', KNOWN)).toBe(true);
    expect(hasProtocolMarkup("<user_objective>build X</user_objective>", KNOWN)).toBe(true);
    expect(hasProtocolMarkup("<function=web_search>", KNOWN)).toBe(true);
  });

  test("flags known tool tags", () => {
    expect(hasProtocolMarkup('<write_todos>{"todos":[]}</write_todos>', KNOWN)).toBe(true);
    expect(hasProtocolMarkup("<delegate_task />", KNOWN)).toBe(true);
  });

  test("does not flag ordinary text, emails or inline HTML", () => {
    expect(hasProtocolMarkup("Contact <support@example.com> for help", KNOWN)).toBe(false);
    expect(hasProtocolMarkup("a<b means strictly less than", KNOWN)).toBe(false);
    expect(hasProtocolMarkup('<div class="note">inline html</div>', KNOWN)).toBe(false);
    expect(hasProtocolMarkup("Here is the final answer.", KNOWN)).toBe(false);
  });

  test("does not flag unknown tool tags outside the known set", () => {
    expect(hasProtocolMarkup("<unknown_tool>x</unknown_tool>", new Set([]))).toBe(false);
  });
});
