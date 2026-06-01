import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { ProviderFactory, StrategyFactory, AgentHarness } from "../../implementation/harness";
import { toolRegistry } from "../../implementation/harness/tools/registry";
import { logger } from "../../shared/utils/logger";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export function startWorker() {
  logger.info(`Starting BullMQ background worker on Redis: ${REDIS_URL}`);
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  });

  connection.on("error", (err) => {
    logger.warn(`Redis connection error in Worker: ${err.message}. Worker will retry automatically.`);
  });

  const worker = new Worker(
    "agent-missions",
    async (job: Job) => {
      const { message, model, missionId, history, mode } = job.data;
      logger.info(`Worker starting job for mission ${missionId}`);

      const targetModel = model || "deepseek-r1-distill-llama-8b";
      const baseURL = process.env.LLM_MODEL_API_URL || "http://localhost:1234/v1";

      const provider = ProviderFactory.create(targetModel, baseURL);
      await toolRegistry.autoload();

      const strategy = StrategyFactory.create(mode || "standard");
      const harness = new AgentHarness({ provider, strategy });

      const historyMessages = (history || []).map((m: { role: string; content: string }) =>
        m.role === "user" || m.role === "human" ? new HumanMessage(m.content) : new AIMessage(m.content)
      );

      const pubClient = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
      });

      const pubChannel = `mission:${missionId}:packets`;

      pubClient.on("error", (err) => {
        logger.warn(`Redis pubClient connection error for mission ${missionId}: ${err.message}`);
      });

      try {
        await harness.runMission(
          message,
          historyMessages,
          async (packet: any) => {
            try {
              await pubClient.publish(pubChannel, JSON.stringify(packet));
            } catch (pubErr: any) {
              logger.warn(`Failed to publish packet to channel: ${pubErr.message}`);
            }
            if (packet.type === 'usage' || packet.type === 'metadata') {
               await job.updateProgress(100);
            }
          },
          missionId
        );

        try {
          await pubClient.publish(pubChannel, JSON.stringify({ type: 'done', missionId }));
        } catch (pubErr: any) {
          logger.warn(`Failed to publish done packet: ${pubErr.message}`);
        }
      } catch (err: any) {
        logger.error(`Mission ${missionId} failed in worker`, err);
        try {
          await pubClient.publish(
            pubChannel,
            JSON.stringify({
              type: "error",
              content: "An internal error occurred during background mission orchestration.",
              meta: { message: err.message },
            })
          );
        } catch (pubErr: any) {
          logger.warn(`Failed to publish error packet: ${pubErr.message}`);
        }
        throw err;
      } finally {
        try {
          await pubClient.quit();
        } catch (quitErr) {
          // ignore
        }
      }
    },
    { connection }
  );

  worker.on("error", (err) => {
    // Swallowed to prevent crash
  });

  worker.on("completed", (job) => {
    logger.info(`Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, err) => {
    logger.error(`Job ${job?.id} failed`, err);
  });

  return worker;
}
