import { StrategyFactory } from "../factory";
import { NLAHStrategy } from "../nlah";
import { StandardStrategy } from "../standard";

describe("StrategyFactory", () => {
  test('create("standard") returns StandardStrategy', () => {
    expect(StrategyFactory.create("standard")).toBeInstanceOf(StandardStrategy);
  });

  test('create("chat") returns StandardStrategy', () => {
    expect(StrategyFactory.create("chat")).toBeInstanceOf(StandardStrategy);
  });

  test("mode is case-insensitive", () => {
    expect(StrategyFactory.create("STANDARD")).toBeInstanceOf(StandardStrategy);
    expect(StrategyFactory.create("Chat")).toBeInstanceOf(StandardStrategy);
  });

  test("everything else returns NLAHStrategy", () => {
    expect(StrategyFactory.create("agent")).toBeInstanceOf(NLAHStrategy);
    expect(StrategyFactory.create("deep-research")).toBeInstanceOf(NLAHStrategy);
    expect(StrategyFactory.create("unknown-mode")).toBeInstanceOf(NLAHStrategy);
  });
});
