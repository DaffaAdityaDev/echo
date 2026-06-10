import { AgentStrategy } from "../../../shared/types";
import { StandardStrategy } from "./standard";
import { ReActStrategy } from "./re-act";
import { NLAHStrategy } from "./nlah";
import { STRATEGY_MAPPINGS } from "./constants";

export class StrategyFactory {
    static create(mode: string): AgentStrategy {
        const modeLower = mode.toLowerCase();
        
        if (STRATEGY_MAPPINGS.REACT.includes(modeLower)) {
            // Legacy ReAct coordinator (retained for learning reference)
            return new ReActStrategy();
        }
        
        if (STRATEGY_MAPPINGS.NLAH.includes(modeLower)) {
            // Production Standard: Natural-Language Agent Harness coordinator
            return new NLAHStrategy();
        }

        // Default or Legacy Standard/Chat coordinator (retained for learning reference)
        return new StandardStrategy();
    }
}
