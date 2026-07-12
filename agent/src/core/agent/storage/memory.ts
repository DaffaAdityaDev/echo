import { AgentState } from '../../../shared/types';
import { serializeAgentState, deserializeAgentState } from './serializer';

export class InMemoryStateProvider {
    private cache = new Map<string, string>();

    async get(missionId: string): Promise<AgentState | null> {
        const raw = this.cache.get(missionId);
        if (!raw) return null;
        return deserializeAgentState(JSON.parse(raw));
    }

    async set(missionId: string, state: AgentState): Promise<void> {
        const serialized = serializeAgentState(state);
        this.cache.set(missionId, JSON.stringify(serialized));
    }

    async delete(missionId: string): Promise<void> {
        this.cache.delete(missionId);
    }
}
