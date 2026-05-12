import { AgentStrategy } from "../types";
import { StandardStrategy } from "./standard";
import { ReActStrategy } from "./re-act";

export class StrategyFactory {
    static create(mode: string): AgentStrategy {
        switch (mode.toLowerCase()) {
            case 'react':
            case 'agent':
                return new ReActStrategy();
            case 'standard':
            case 'chat':
            default:
                return new StandardStrategy();
        }
    }
}
