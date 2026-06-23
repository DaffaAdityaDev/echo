import { Redis } from 'ioredis';
import { ENV } from '../config/env';
import { logger } from '../shared/utils/logger';

let redisClient: Redis | null = null;

if (ENV.REDIS_URL) {
    redisClient = new Redis(ENV.REDIS_URL, {
        maxRetriesPerRequest: null,
    });
    redisClient.on('error', (err) => {
        logger.error('Shared Redis client error:', err);
    });
}

export { redisClient };
