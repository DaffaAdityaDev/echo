import { HARNESS_PROMPTS } from "../prompts";

describe("HARNESS_PROMPTS", () => {
  test("stuck classifier system prompt is non-empty and references the protocol", () => {
    expect(HARNESS_PROMPTS.STUCK_CLASSIFIER_SYSTEM.length).toBeGreaterThan(0);
    expect(HARNESS_PROMPTS.STUCK_CLASSIFIER_SYSTEM).toContain("COMPLETE");
    expect(HARNESS_PROMPTS.STUCK_CLASSIFIER_SYSTEM).toContain("STUCK");
  });

  test("stuck classifier user prompt interpolates objective and assistant content", () => {
    const prompt = HARNESS_PROMPTS.STUCK_CLASSIFIER_USER("build a parser", "I should search for docs");
    expect(prompt).toContain("build a parser");
    expect(prompt).toContain("I should search for docs");
    expect(prompt).toContain("COMPLETE");
    expect(prompt).toContain("STUCK");
  });

  test("compaction prompts exist and define the required JSON schema", () => {
    expect(HARNESS_PROMPTS.COMPACTION_SYSTEM.length).toBeGreaterThan(0);
    expect(HARNESS_PROMPTS.COMPACTION_PROMPT).toContain("decisions");
    expect(HARNESS_PROMPTS.COMPACTION_PROMPT).toContain("next_course_of_action");
    expect(HARNESS_PROMPTS.COMPACTION_PROMPT).toContain("JSON");
  });

  test("compaction wrapper renders summary and numbered next steps", () => {
    const summary = JSON.stringify({
      decisions: ["d1"],
      next_course_of_action: [
        { priority: 1, action: "step one" },
        { priority: 2, action: "step two" },
      ],
    });
    const out = HARNESS_PROMPTS.COMPACTION_SUMMARY_WRAPPER(1, summary);
    expect(out).toContain("<context_reconstruction>");
    expect(out).toContain("<summary>");
    expect(out).toContain("<next_steps>");
    expect(out).toContain("1. step one");
    expect(out).toContain("2. step two");
    expect(out).toContain("<summary>");
  });

  test("compaction wrapper parses fenced JSON summaries", () => {
    const summary = `\`\`\`json\n${JSON.stringify({ decisions: ["d1"] })}\n\`\`\``;
    const out = HARNESS_PROMPTS.COMPACTION_SUMMARY_WRAPPER(1, summary);
    expect(out).toContain("<summary>");
    expect(out).not.toContain("<next_steps>");
  });

  test("compaction wrapper omits next_steps when absent", () => {
    const out = HARNESS_PROMPTS.COMPACTION_SUMMARY_WRAPPER(1, JSON.stringify({ decisions: ["d1"] }));
    expect(out).toContain("<summary>");
    expect(out).not.toContain("<next_steps>");
  });

  test("compaction wrapper falls back to summary-only on invalid JSON", () => {
    const out = HARNESS_PROMPTS.COMPACTION_SUMMARY_WRAPPER(1, "not json at all");
    expect(out).toContain("<context_reconstruction>");
    expect(out).toContain("<summary>");
    expect(out).toContain("not json at all");
    expect(out).not.toContain("<next_steps>");
  });

  test("pacing warning includes the iteration and mandates a final answer", () => {
    const out = HARNESS_PROMPTS.PACING_WARNING(7);
    expect(out).toContain("7");
    expect(out).toContain("FINAL ANSWER");
    expect(out).toContain("SYSTEM FORCED SYNTHESIS");
  });

  test("recovery, repeating, and feedback prompts are non-empty", () => {
    expect(HARNESS_PROMPTS.REPEATING_WARNING.length).toBeGreaterThan(0);
    expect(HARNESS_PROMPTS.RECOVERY_PROMPT).toContain("tool");
    expect(HARNESS_PROMPTS.FEEDBACK_PROMPT).toContain("FINAL ANSWER");
  });

  test("log compacted prompt includes the token count", () => {
    expect(HARNESS_PROMPTS.LOG_COMPACTED(1234)).toContain("1234");
    expect(HARNESS_PROMPTS.LOG_COMPACTED(1234)).toContain("compacted");
  });

  test("financial abort includes formatted threshold and spend", () => {
    const out = HARNESS_PROMPTS.FINANCIAL_ABORT(10, 12.3456);
    expect(out).toContain("10.00");
    expect(out).toContain("12.3456");
    expect(out).toContain("FINANCIAL_ABORT");
  });

  test("markdown ledger header interpolates run metadata", () => {
    const out = HARNESS_PROMPTS.MD_LEDGER_HEADER("12:00", "mission-1", 3, "nlah", "memory", 42, "<system>");
    expect(out).toContain("12:00");
    expect(out).toContain("mission-1");
    expect(out).toContain("ITERATION: 3");
    expect(out).toContain("NLAH");
    expect(out).toContain("memory");
    expect(out).toContain("42 messages");
    expect(out).toContain("<system>");
  });

  test("pure ledger interpolates run metadata", () => {
    const out = HARNESS_PROMPTS.PURE_LEDGER(2, "mission-2", "13:00", "sys", "msgs");
    expect(out).toContain("ITERATION: 2");
    expect(out).toContain("mission-2");
    expect(out).toContain("13:00");
    expect(out).toContain("sys");
    expect(out).toContain("msgs");
  });
});
