import { describe, expect, it } from "vitest";
import { NLAHStrategy } from "../nlah";
import { StrategyRegistry, strategyRegistry } from "../registry";
import { StandardStrategy } from "../standard";

describe("StrategyRegistry", () => {
  const registry = new StrategyRegistry();

  it("should list all registered strategies and versions", () => {
    const catalog = registry.list();
    expect(catalog).toHaveLength(2);

    const standardEntry = catalog.find((entry) => entry.name === "standard");
    expect(standardEntry).toBeDefined();
    expect(standardEntry?.versions[0].version).toBe("standard:v1");
    expect(standardEntry?.versions[0].aliases).toContain("chat");

    const nlahEntry = catalog.find((entry) => entry.name === "nlah");
    expect(nlahEntry).toBeDefined();
    expect(nlahEntry?.versions[0].version).toBe("nlah:v1");
    expect(nlahEntry?.versions[0].aliases).toContain("agent");
  });

  it("should resolve version strings and aliases to strategy instances", () => {
    expect(registry.resolve("standard:v1")).toBeInstanceOf(StandardStrategy);
    expect(registry.resolve("chat")).toBeInstanceOf(StandardStrategy);

    expect(registry.resolve("nlah:v1")).toBeInstanceOf(NLAHStrategy);
    expect(registry.resolve("agent")).toBeInstanceOf(NLAHStrategy);
    expect(registry.resolve("deep-research")).toBeInstanceOf(NLAHStrategy);
    expect(registry.resolve("react")).toBeInstanceOf(NLAHStrategy);
    expect(registry.resolve("sequential")).toBeInstanceOf(NLAHStrategy);
  });

  it("should resolve versions and aliases to concrete strategies", () => {
    expect(registry.resolve("nlah:v1")).toBeInstanceOf(NLAHStrategy);
    expect(registry.resolve("standard:v1")).toBeInstanceOf(StandardStrategy);
  });

  it("should export a singleton strategyRegistry instance", () => {
    expect(strategyRegistry).toBeInstanceOf(StrategyRegistry);
    expect(strategyRegistry.list()).toHaveLength(2);
  });
});
