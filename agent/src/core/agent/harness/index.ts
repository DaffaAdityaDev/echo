import { AgentState } from '../../../shared/types';
import { AgentHarness as IAgentHarness, HarnessConfig } from './types';
import { HarnessFactory } from './factory';

export class AgentHarness implements IAgentHarness {
    private impl: IAgentHarness;

    constructor(options: HarnessConfig) {
        const harnessType = options.harnessType || 'nlah';
        this.impl = HarnessFactory.create(harnessType, options);
    }

    async runMission(
        state: AgentState,
        onPacket: (packet: any) => Promise<void>,
        traceparent?: string
    ): Promise<void> {
        return this.impl.runMission(state, onPacket, traceparent);
    }
}

export { HarnessFactory } from './factory';
export type { HarnessConfig, AgentHarness as IAgentHarness } from './types';
