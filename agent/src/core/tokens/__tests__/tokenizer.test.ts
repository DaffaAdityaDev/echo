import { describe, expect, test } from "vitest";
import { countTokens } from "../tokenizer";

describe("countTokens", () => {
  test("counts English text with BPE tokenizer", () => {
    expect(countTokens("Hello world, this is a test.")).toBeGreaterThan(0);
  });

  test("counts Indonesian text", () => {
    const tokens = countTokens("Halo, ini percakapan Bahasa Indonesia untuk menguji tokenizer.");
    expect(tokens).toBeGreaterThan(0);
  });

  test("empty string yields zero tokens", () => {
    expect(countTokens("")).toBe(0);
  });

  test("large 4MB text is counted consistently", () => {
    const big = "Pagination berbasis offset memang paling mudah diimplementasikan. ".repeat(40000);
    const a = countTokens(big);
    const b = countTokens(big);
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
  });

  test("matches known o200k sample (Hello world = 2 tokens)", () => {
    expect(countTokens("Hello world")).toBe(2);
  });
});
