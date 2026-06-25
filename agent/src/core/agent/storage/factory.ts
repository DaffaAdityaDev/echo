import { IStateProvider } from './types';
import { InMemoryStateProvider } from './memory';
import { logger } from '../../../shared/utils/logger';
import { STORAGE_LOG_MESSAGES } from './constants';

const stateStorage: IStateProvider = new InMemoryStateProvider();
logger.info(STORAGE_LOG_MESSAGES.MEMORY_ACTIVE);

export { stateStorage };
export * from './types';