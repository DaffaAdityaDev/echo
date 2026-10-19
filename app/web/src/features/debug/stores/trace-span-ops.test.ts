import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compactMetadata } from "./trace-span-ops";

describe("compactMetadata", () => {
  it("drops undefined fields so metadata stays valid JSON", () => {
    assert.deepEqual(compactMetadata({ strategy: "react", historyDepth: undefined, toolsAvailable: ["a"] }), {
      strategy: "react",
      toolsAvailable: ["a"],
    });
  });

  it("keeps null and falsy JSON values", () => {
    assert.deepEqual(compactMetadata({ code: null, count: 0, flag: false, label: "" }), {
      code: null,
      count: 0,
      flag: false,
      label: "",
    });
  });
});
