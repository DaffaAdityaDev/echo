import { AgentStrategy } from "../../../shared/types";
import { StandardStrategy } from "./standard";
import { ReActStrategy } from "./re-act";
import { NLAHStrategy } from "./nlah";

export class StrategyFactory {
    static create(mode: string): AgentStrategy {
        switch (mode.toLowerCase()) {
            case 'react':
            case 'agent':
                // Legacy ReAct coordinator (retained for learning reference)
                return new ReActStrategy();
            case 'nlah':
            case 'deep-research':
                // Production Standard: Natural-Language Agent Harness coordinator
                return new NLAHStrategy();
            case 'standard':
            case 'chat':
            default:
                // Legacy Standard/Chat coordinator (retained for learning reference)
                return new StandardStrategy();
        }
    }
}
