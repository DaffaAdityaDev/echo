import type { AgentStrategy } from "../../../shared/types";
import { NLAHStrategy } from "./nlah";
import { StandardStrategy } from "./standard";

export class StrategyFactory {
  static create(mode: string): AgentStrategy {
    return ["standard", "chat"].includes(mode.toLowerCase()) ? new StandardStrategy() : new NLAHStrategy();
  }
}
