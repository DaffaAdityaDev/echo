import { AgentStrategy } from "../types";
import { StandardStrategy } from "./standard";
import { ReActStrategy } from "./re-act";
import { NLAHStrategy } from "./nlah";

export class StrategyFactory {
    static create(mode: string): AgentStrategy {
        switch (mode.toLowerCase()) {
            case 'react':
            case 'agent':
                return new ReActStrategy();
            case 'nlah':
            case 'deep-research':
                return new NLAHStrategy();
            case 'standard':
            case 'chat':
            default:
                return new StandardStrategy();
        }
    }
}
