import { ENV } from '../../../config/env';
import { IStateProvider } from './types';
import { InMemoryStateProvider } from './memory';
import { RedisStateProvider } from './redis';
import { logger } from '../../../shared/utils/logger';

let stateStorage: IStateProvider;

if (ENV.STATE_BACKEND === 'redis' && ENV.REDIS_URL) {
    stateStorage = new RedisStateProvider(ENV.REDIS_URL);
    logger.info("🔋 Agent State Channel: REDIS BACKEND ACTIVE");
} else {
    stateStorage = new InMemoryStateProvider();
    logger.info("🧠 Agent State Channel: PURE RAM INSTANCE ACTIVE");
}

export { stateStorage };
export * from './types';
