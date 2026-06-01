import { Queue } from "bullmq";
import Redis from "ioredis";
import { logger } from "../../shared/utils/logger";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

class QueueServiceImpl {
  private redisConnection?: Redis;
  public missionQueue?: Queue;

  constructor() {
    if (process.env.ENABLE_REDIS !== "true") {
      logger.info("Redis is disabled (ENABLE_REDIS is not 'true'). QueueService running in offline/stub mode.");
      return;
    }

    logger.info(`Connecting QueueService to Redis: ${REDIS_URL}`);
    this.redisConnection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
    });

    this.redisConnection.on("error", (err) => {
      logger.warn(`Redis connection error in QueueService: ${err.message}. Background queue is offline.`);
    });
    
    this.missionQueue = new Queue("agent-missions", {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    this.missionQueue.on("error", (err) => {
      // Swallowed to prevent crash
    });
  }

  async enqueue(payload: {
    message: string;
    model?: string;
    missionId: string;
    mode?: string;
    history?: any[];
  }) {
    if (process.env.ENABLE_REDIS !== "true" || !this.missionQueue) {
      throw new Error("Background queue service is disabled because Redis is offline or not enabled (ENABLE_REDIS=true).");
    }

    try {
      logger.info(`Enqueuing background mission ${payload.missionId}`);
      const job = await this.missionQueue.add(
        `run-${payload.missionId}`,
        payload,
        { jobId: payload.missionId }
      );
      return { jobId: job.id, missionId: payload.missionId };
    } catch (err: any) {
      logger.error(`Failed to enqueue mission: ${err.message}`);
      throw new Error(`Background queue service is currently unavailable. Redis error: ${err.message}`);
    }
  }

  async getJobStatus(jobId: string) {
    if (process.env.ENABLE_REDIS !== "true" || !this.missionQueue) {
      return { id: jobId, state: "error", error: "Queue database unavailable (ENABLE_REDIS=false)" };
    }

    try {
      const job = await this.missionQueue.getJob(jobId);
      if (!job) return null;

      const state = await job.getState();
      const progress = job.progress;
      return {
        id: job.id,
        state,
        progress,
        failedReason: job.failedReason,
        returnValue: job.returnvalue,
      };
    } catch (err: any) {
      logger.error(`Failed to get job status: ${err.message}`);
      return { id: jobId, state: "error", error: "Queue database unavailable" };
    }
  }
}

export const QueueService = new QueueServiceImpl();
