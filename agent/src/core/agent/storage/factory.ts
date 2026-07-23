import { InMemoryStateProvider } from './memory';
import { MemoryAdapter } from '../../../adapter/backend/memory.adapter';
import { logger } from '../../../shared/utils/logger';
import { STORAGE_LOG_MESSAGES } from './constants';
import { ENV } from '../../../config/env';

function createStateProvider() {
  if (ENV.STATE_BACKEND === 'backend') {
    const provider = new MemoryAdapter(ENV.BACKEND_URL);
    logger.info('🧠 Agent State Channel: BACKEND PERSISTENCE ACTIVE');
    return provider;
  }
  logger.info(STORAGE_LOG_MESSAGES.MEMORY_ACTIVE);
  return new InMemoryStateProvider();
}

const stateStorage = createStateProvider();

export { stateStorage };