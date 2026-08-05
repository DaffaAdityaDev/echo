import { AsyncLocalStorage } from "node:async_hooks";
import { CallbackHandler } from "@langfuse/langchain";
import { type LangfuseSpan, propagateAttributes, startObservation } from "@langfuse/tracing";
import { ENV } from "../../config/env";
import { logger } from "../../shared/utils/logger";

export type LangfuseTrace = LangfuseSpan & {
  generation?: (params: { name: string; model?: string; input?: unknown; metadata?: Record<string, unknown> }) => {
    end: (params?: unknown) => void;
  };
};

export interface LangfuseStorageContext {
  trace?: LangfuseTrace | null;
  span?: LangfuseSpan | null;
  sessionId?: string;
  userId?: string;
}

export const langfuseStorage = new AsyncLocalStorage<LangfuseStorageContext>();

export async function getLangChainCallbacks(): Promise<CallbackHandler[]> {
  try {
    const store = langfuseStorage.getStore();
    const tracer = new CallbackHandler({
      sessionId: store?.sessionId,
      userId: store?.userId,
    });
    return [tracer];
  } catch (err) {
    logger.error("⚠️ Failed to resolve LangChain callbacks:", err);
    return [];
  }
}

export function startAgentTrace(
  _traceId: string,
  missionId: string,
  _userId: string,
  strategyName: string,
  objective: string,
): LangfuseTrace | null {
  try {
    logger.info(`Starting Langfuse trace for mission ${missionId} (Strategy: ${strategyName})`);

    const trace = startObservation("agent-run-mission", {
      input: objective,
      metadata: {
        strategy: strategyName,
      },
      version: "5.0.0",
    });

    if (trace) {
      const baseUrl = ENV.LANGFUSE_BASE_URL;
      logger.info(
        `[LANGFUSE] Trace started successfully. Trace ID: ${trace.traceId} | Mission ID: ${missionId} | View at: ${baseUrl}/traces/${trace.traceId} (if project ID is known) or search Trace ID: ${trace.traceId}`,
      );
    }

    return trace;
  } catch (err) {
    logger.error("❌ Failed to start Agent Trace:", err);
    return null;
  }
}

export { propagateAttributes };
