import { AgentState } from '../../../shared/types';

export interface IStateProvider {
    get(missionId: string): Promise<AgentState | null>;
    set(missionId: string, state: AgentState, ttlSeconds?: number): Promise<void>;
    delete(missionId: string): Promise<void>;
}
