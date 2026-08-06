import { describe, expect, test } from "vitest";
import { ContentSanitizer } from "../content_sanitizer";

describe("ContentSanitizer", () => {
  test("strips fake write_todos tool trace blocks", () => {
    const s = new ContentSanitizer();
    const out = s.sanitize('Answer text. <write_todos>{"todos":[]}</write_todos> tail.');
    expect(out).not.toContain("<write_todos>");
    expect(out).not.toContain("todos");
    expect(out).toContain("Answer text.");
    expect(out).toContain("tail.");
  });

  test("strips delegate_task blocks", () => {
    const s = new ContentSanitizer();
    const out = s.sanitize('A <delegate_task>{"instructions":"x"}</delegate_task> B');
    expect(out).not.toContain("delegate_task");
    expect(out).toBe("A  B");
  });

  test("strips DSML invoke blocks", () => {
    const s = new ContentSanitizer();
    const out = s.sanitize(
      '<dsml><tool_calls><dsml><invoke name="write_todos"><dsml><parameter name="todos" string="false">[]</parameter></dsml></invoke></dsml></tool_calls> hello',
    );
    expect(out).not.toContain("dsml");
    expect(out).not.toContain("invoke");
    expect(out).toContain("hello");
  });

  test("strips echoed <user_objective> delimiters", () => {
    const s = new ContentSanitizer();
    const out = s.sanitize("<user_objective>Halo</user_objective> Baik, saya menjawab.");
    expect(out).not.toContain("user_objective");
    expect(out).toContain("Baik, saya menjawab.");
  });

  test("handles tags split across chunks", () => {
    const s = new ContentSanitizer();
    const a = s.sanitize('Start <write_todos>{"todos"');
    const b = s.sanitize(":[]}</write_todos> end");
    const c = s.flush();
    const all = a + b + c;
    expect(all).not.toContain("write_todos");
    expect(all).toContain("Start");
    expect(all).toContain("end");
  });

  test("keeps normal text and legitimate angle brackets", () => {
    const s = new ContentSanitizer();
    const out = s.sanitize("a < b and x <3 y. Normal paragraph.");
    expect(out).toContain("a < b and x <3 y");
    expect(out).toContain("Normal paragraph.");
  });

  test("handles single-character chunks (streamed tag)", () => {
    const s = new ContentSanitizer();
    let out = "";
    for (const ch of [
      "<",
      "w",
      "r",
      "i",
      "t",
      "e",
      "_",
      "t",
      "o",
      "d",
      "o",
      "s",
      ">",
      "{",
      '"',
      "t",
      "}",
      "}",
      "<",
      "/",
      "w",
      "r",
      "i",
      "t",
      "e",
      "_",
      "t",
      "o",
      "d",
      "o",
      "s",
      ">",
      " clean",
    ]) {
      out += s.sanitize(ch);
    }
    out += s.flush();
    expect(out).not.toContain("write_todos");
    expect(out).toContain("clean");
  });

  test("strips leaked T5-style trace (write_todos + markdown list body)", () => {
    const s = new ContentSanitizer();
    const out = s.sanitize(
      "I'll run through the workflow. <write_todos> - [pending] Record objective - [pending] Delegate task </write_todos> The harness is operational.",
    );
    expect(out).not.toContain("write_todos");
    expect(out).not.toContain("[pending]");
    expect(out).toContain("The harness is operational.");
  });

  test("strips delegate_task JSON body across chunks", () => {
    const s = new ContentSanitizer();
    const a = s.sanitize('Plan: <delegate_task>{"instructions":"riset');
    const b = s.sanitize('","agentName":"researcher"}</delegate_task> Selesai.');
    const out = a + b + s.flush();
    expect(out).not.toContain("delegate_task");
    expect(out).not.toContain("instructions");
    expect(out).toContain("Selesai.");
  });

  test("flushes held-back tail", () => {
    const s = new ContentSanitizer();
    const emitted = s.sanitize("hello <write_todos");
    const flushed = s.flush();
    expect(emitted + flushed).toBe("hello ");
  });

  test("keeps a legitimate unclosed '<tag' that is not a known tool name", () => {
    const s = new ContentSanitizer();
    const emitted = s.sanitize("result: a<b");
    const out = emitted + s.flush();
    expect(out).toContain("a<b");
  });

  test("bounds the hold window so a never-closing split tool tag is released", () => {
    const s = new ContentSanitizer();
    const a = s.sanitize("start <write_todos ");
    const b = s.sanitize("x".repeat(200));
    const out = a + b + s.flush();
    expect(out).not.toContain("write_todos");
    expect(out).toContain("start");
  });
});
