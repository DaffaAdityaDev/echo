import { IStateProvider } from './types';
import { AgentState } from '../../../shared/types';
import { Redis } from 'ioredis';
import { serializeAgentState, deserializeAgentState } from './serializer';
import { logger } from '../../../shared/utils/logger';
import { STORAGE_CONSTANTS, STORAGE_LOG_MESSAGES } from './constants';

export class RedisStateProvider implements IStateProvider {
    private client: Redis;

    constructor(connectionString: string) {
        this.client = new Redis(connectionString);
        this.client.on('error', (err) => {
            logger.error(STORAGE_LOG_MESSAGES.REDIS_ERROR, err);
        });
    }

    async get(missionId: string): Promise<AgentState | null> {
        const raw = await this.client.get(`${STORAGE_CONSTANTS.REDIS_KEY_PREFIX}${missionId}`);
        if (!raw) return null;
        return deserializeAgentState(JSON.parse(raw));
    }

    async set(missionId: string, state: AgentState, ttlSeconds = STORAGE_CONSTANTS.DEFAULT_TTL_SECONDS): Promise<void> {
        const serialized = serializeAgentState(state);
        await this.client.set(
            `${STORAGE_CONSTANTS.REDIS_KEY_PREFIX}${missionId}`,
            JSON.stringify(serialized),
            STORAGE_CONSTANTS.REDIS_EX_MODE,
            ttlSeconds
        );
    }

    async delete(missionId: string): Promise<void> {
        await this.client.del(`${STORAGE_CONSTANTS.REDIS_KEY_PREFIX}${missionId}`);
    }
}
