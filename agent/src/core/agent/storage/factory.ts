import { ENV } from '../../../config/env';
import { IStateProvider } from './types';
import { InMemoryStateProvider } from './memory';
import { RedisStateProvider } from './redis';
import { logger } from '../../../shared/utils/logger';
import { STORAGE_CONSTANTS, STORAGE_LOG_MESSAGES } from './constants';

let stateStorage: IStateProvider;

if (ENV.STATE_BACKEND === STORAGE_CONSTANTS.BACKEND_REDIS && ENV.REDIS_URL) {
    stateStorage = new RedisStateProvider(ENV.REDIS_URL);
    logger.info(STORAGE_LOG_MESSAGES.REDIS_ACTIVE);
} else {
    stateStorage = new InMemoryStateProvider();
    logger.info(STORAGE_LOG_MESSAGES.MEMORY_ACTIVE);
}

export { stateStorage };
export * from './types';
