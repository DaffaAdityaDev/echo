import type { AgentStrategy } from "../../../shared/types";
import { NLAHStrategy } from "./nlah";
import { StandardStrategy } from "./standard";

export const StrategyFactory = {
  create(mode: string): AgentStrategy {
    return ["standard", "chat"].includes(mode.toLowerCase()) ? new StandardStrategy() : new NLAHStrategy();
  },
};
