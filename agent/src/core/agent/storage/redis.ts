import { IStateProvider } from './types';
import { AgentState } from '../../../shared/types';
import { Redis } from 'ioredis';
import { serializeAgentState, deserializeAgentState } from './serializer';
import { logger } from '../../../shared/utils/logger';

export class RedisStateProvider implements IStateProvider {
    private client: Redis;

    constructor(connectionString: string) {
        this.client = new Redis(connectionString);
        this.client.on('error', (err) => {
            logger.error('Redis Client Error', err);
        });
    }

    async get(missionId: string): Promise<AgentState | null> {
        const raw = await this.client.get(`agent:state:${missionId}`);
        if (!raw) return null;
        return deserializeAgentState(JSON.parse(raw));
    }

    async set(missionId: string, state: AgentState, ttlSeconds = 3600): Promise<void> {
        const serialized = serializeAgentState(state);
        await this.client.set(
            `agent:state:${missionId}`,
            JSON.stringify(serialized),
            'EX',
            ttlSeconds
        );
    }

    async delete(missionId: string): Promise<void> {
        await this.client.del(`agent:state:${missionId}`);
    }
}
