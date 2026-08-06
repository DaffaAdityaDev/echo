import { applyBoundTools } from "../bound_tools";

describe("applyBoundTools", () => {
  test("returns tools unchanged when boundTools is empty", () => {
    const tools = [{ name: "a" }, { name: "b" }];
    expect(applyBoundTools(tools, [])).toBe(tools);
  });

  test("filters tools down to the bound allowlist", () => {
    const tools = [{ name: "a" }, { name: "b" }, { name: "c" }];
    expect(applyBoundTools(tools, ["a", "c"])).toEqual([{ name: "a" }, { name: "c" }]);
  });

  test("preserves the original tool order", () => {
    const tools = [{ name: "c" }, { name: "a" }, { name: "b" }, { name: "d" }];
    expect(applyBoundTools(tools, ["d", "a", "c"])).toEqual([{ name: "c" }, { name: "a" }, { name: "d" }]);
  });

  test("returns an empty array when nothing is bound", () => {
    const tools = [{ name: "a" }, { name: "b" }];
    expect(applyBoundTools(tools, ["z"])).toEqual([]);
  });
});
