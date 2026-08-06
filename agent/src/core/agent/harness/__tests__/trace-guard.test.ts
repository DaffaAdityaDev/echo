import { describe, expect, it } from "vitest";
import { isFakeToolTrace } from "../trace-guard";

describe("isFakeToolTrace", () => {
  it("detects Tool Action traces", () => {
    expect(isFakeToolTrace('Tool Action: web_search\n{"query": "news"}')).toBe(true);
  });

  it("detects Observation traces", () => {
    expect(isFakeToolTrace("Observation: web_search\nSearch results")).toBe(true);
  });

  it("detects copied search-result headers", () => {
    expect(isFakeToolTrace('Search results for "current EST time":\n1. **Title**')).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(isFakeToolTrace("tool action: delegate_task")).toBe(true);
    expect(isFakeToolTrace("observation: write_todos")).toBe(true);
  });

  it("does not flag normal answers", () => {
    expect(isFakeToolTrace("The current EST time is 2:30 PM on August 5, 2026.")).toBe(false);
    expect(isFakeToolTrace("I cannot search the web because it is not enabled.")).toBe(false);
    expect(isFakeToolTrace("Search results were inconclusive for that topic.")).toBe(false);
  });

  it("handles empty content", () => {
    expect(isFakeToolTrace("")).toBe(false);
  });
});
