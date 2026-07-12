import { LLMProvider, AgentStrategy, AgentState, ToolDefinition } from '../../../shared/types';

export interface HarnessConfig {
    provider: LLMProvider;
    strategy: AgentStrategy;
    missionId?: string;
    tenantId?: string;
    harnessType?: string;
    tools?: ToolDefinition[];
    skills?: string[];
    harnessConfig?: any;
}


