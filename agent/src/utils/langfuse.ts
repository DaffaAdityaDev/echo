import { AsyncLocalStorage } from "node:async_hooks";
import { CallbackHandler } from "@langfuse/langchain";
import { startObservation, propagateAttributes } from "@langfuse/tracing";
import { logger } from "../shared/utils/logger";
import { ENV } from "../config/env";

export interface LangfuseStorageContext {
    trace?: any;
    span?: any;
    sessionId?: string;
    userId?: string;
}

export const langfuseStorage = new AsyncLocalStorage<LangfuseStorageContext>();

export async function getLangChainCallbacks(): Promise<any[]> {
    try {
        const store = langfuseStorage.getStore();
        // Initialize CallbackHandler which automatically links with active OTel context
        const tracer = new CallbackHandler({
            sessionId: store?.sessionId,
            userId: store?.userId,
        });
        return [tracer];
    } catch (err: any) {
        logger.error("⚠️ Failed to resolve LangChain callbacks:", err);
        return [];
    }
}

/**
 * Starts a root trace for an agent mission using OpenTelemetry-based Langfuse SDK.
 */
export function startAgentTrace(
    traceId: string,
    missionId: string,
    userId: string,
    strategyName: string,
    objective: string
): any {
    try {
        logger.info(`Starting Langfuse trace for mission ${missionId} (Strategy: ${strategyName})`);
        
        // startObservation starts a span/trace in the OTel provider
        const trace = startObservation("agent-run-mission", {
            input: objective,
            metadata: {
                strategy: strategyName,
            },
            version: "5.0.0",
        });

        if (trace) {
            const baseUrl = ENV.LANGFUSE_BASE_URL;
            logger.info(`[LANGFUSE] Trace started successfully. Trace ID: ${trace.traceId} | Mission ID: ${missionId} | View at: ${baseUrl}/traces/${trace.traceId} (if project ID is known) or search Trace ID: ${trace.traceId}`);
        }

        return trace;
    } catch (err) {
        logger.error("❌ Failed to start Agent Trace:", err);
        return null;
    }
}

export { propagateAttributes };
