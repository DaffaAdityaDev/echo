import { LLMProvider, AgentStrategy, AgentState, ToolDefinition } from '../../../shared/types';

export interface HarnessConfig {
    provider: LLMProvider;
    strategy: AgentStrategy;
    missionId?: string;
    tenantId?: string;
    harnessType?: string; // Opt-in harness type selection, default is 'nlah'
    tools?: ToolDefinition[]; // Explicitly bound tools
}

export interface AgentHarness {
    runMission(
        state: AgentState,
        onPacket: (packet: any) => Promise<void>,
        traceparent?: string
    ): Promise<void>;
}
