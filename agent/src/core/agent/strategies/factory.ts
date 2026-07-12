import { AgentStrategy } from "../../../shared/types";
import { StandardStrategy } from "./standard";
import { NLAHStrategy } from "./nlah";

export class StrategyFactory {
    static create(mode: string): AgentStrategy {
        return ['standard', 'chat'].includes(mode.toLowerCase())
            ? new StandardStrategy()
            : new NLAHStrategy();
    }
}
