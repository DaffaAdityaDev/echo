import Redis from "ioredis";
import { logger } from "../../shared/utils/logger";

let client: Redis | null = null;
let available = false;

export function initRedis(url: string): void {
  if (client) return;

  client = new Redis(url, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    connectTimeout: 3000,
  });

  client.on("ready", () => {
    available = true;
    logger.info("Redis connected (mission event store ready)");
  });

  client.on("error", (err) => {
    available = false;
    logger.warn(`Redis unavailable: ${err.message}. Mission stream endpoints will return 503.`);
  });

  client.on("end", () => {
    available = false;
  });

  client.connect().catch((err) => {
    available = false;
    logger.warn(`Redis connection failed: ${err.message}. Mission stream endpoints will return 503.`);
  });
}

export function getRedisClient(): Redis | null {
  return client;
}

export function isRedisAvailable(): boolean {
  return available;
}

export function __setRedisClientForTest(redis: Redis | null, availableFlag = true): void {
  client = redis;
  available = availableFlag;
}

export function closeRedis(): Promise<void> {
  const redis = client;
  client = null;
  available = false;
  return redis ? redis.quit().then(() => undefined) : Promise.resolve();
}
