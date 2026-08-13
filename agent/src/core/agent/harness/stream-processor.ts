import { calculateUsageCost } from "../../../infrastructure/providers/utils";
import type { LLMProvider, ProviderEvent } from "../../../shared/types";
import { estimateCharTokens } from "../../../shared/utils/harness";
import { logger } from "../../../shared/utils/logger";
import { HARNESS_CONFIG } from "./constants";
import type { ContentSanitizer } from "./content_sanitizer";
import type { HarnessEventEmitter } from "./events";
import type { AgentStatusTracker } from "./status-tracker";
import type { HarnessEvent, HarnessRuntimeConfig } from "./types";

export interface ProcessStreamResult {
  assistantContent: string;
  reasoningContent: string;
  pendingToolCall: { name: string; args: Record<string, unknown> } | null;
  hasContentEmitted: boolean;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens?: number;
  } | null;
}

export interface ProcessStreamDeps {
  eventStream: AsyncIterable<ProviderEvent>;
  iteration: number;
  onPacket: (p: HarnessEvent) => Promise<void>;
  emitter: HarnessEventEmitter;
  provider: LLMProvider;
  contentSanitizer: ContentSanitizer;
  statusTracker?: AgentStatusTracker;
  harnessConfig?: HarnessRuntimeConfig;
}

export async function processStreamEvents(deps: ProcessStreamDeps): Promise<ProcessStreamResult> {
  const { eventStream, iteration, onPacket, emitter, provider, contentSanitizer, statusTracker, harnessConfig } = deps;
  let assistantContent = "";
  let reasoningContent = "";
  let pendingToolCall: { name: string; args: Record<string, unknown> } | null = null;
  let hasContentEmitted = false;
  let usageResult: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens?: number;
  } | null = null;
  let tokenEstimate = 0;
  const streamStart = Date.now();
  let lastChunkTime = Date.now();
  const heartbeatIntervalTime =
    harnessConfig?.agentStatus?.heartbeatInterval ?? HARNESS_CONFIG.AGENT_STATUS.HEARTBEAT_INTERVAL;
  const stallTimeout = harnessConfig?.agentStatus?.stallTimeout ?? HARNESS_CONFIG.AGENT_STATUS.STALL_TIMEOUT;

  const heartbeatInterval = setInterval(() => {
    if (Date.now() - emitter.lastActivityAt > stallTimeout) {
      emitter.markStalledIfNeeded(onPacket, iteration).catch(() => {});
    }
    if (Date.now() - lastChunkTime >= heartbeatIntervalTime) {
      emitter.emitHeartbeat(onPacket, iteration).catch(() => {});
    }
  }, heartbeatIntervalTime);

  try {
    for await (const event of eventStream) {
      lastChunkTime = Date.now();

      if (event.reasoning) {
        reasoningContent += event.reasoning;
        tokenEstimate += estimateCharTokens(event.reasoning);
        statusTracker?.update({
          currentThought: (reasoningContent || assistantContent).substring(0, 50),
          throughput:
            (Date.now() - streamStart) / 1000 > 0 ? tokenEstimate / ((Date.now() - streamStart) / 1000) : undefined,
        });
        await emitter.emitReasoning(onPacket, iteration, event.reasoning);
      }
      if (event.content) {
        assistantContent += event.content;
        tokenEstimate += estimateCharTokens(event.content);
        statusTracker?.update({
          currentThought: (reasoningContent || assistantContent).substring(0, 50),
          throughput:
            (Date.now() - streamStart) / 1000 > 0 ? tokenEstimate / ((Date.now() - streamStart) / 1000) : undefined,
        });
      }
      if (event.toolCall) {
        logger.info(`[processStreamEvents] Got toolCall event: ${JSON.stringify(event.toolCall)}`);
        pendingToolCall = event.toolCall;
      }
      if (event.content && !pendingToolCall) {
        hasContentEmitted = true;
        const cleanContent = contentSanitizer.sanitize(event.content);
        if (cleanContent) {
          await emitter.emitContent(onPacket, iteration, cleanContent);
        }
      } else if (event.content && pendingToolCall) {
        logger.info(`[processStreamEvents] Content suppressed — toolCall pending, content_len=${event.content.length}`);
      }
      if (event.usage) {
        const { stepCost } = calculateUsageCost(
          provider.modelName ?? "unknown",
          provider.baseURL ?? "",
          event.usage.promptTokens,
          event.usage.completionTokens,
          event.usage.cachedTokens ?? 0,
        );
        const enrichedUsage = {
          ...event.usage,
          estimatedCostUsd: stepCost,
          maxContextTokens: provider.maxContextTokens,
        };
        await emitter.emitUsage(onPacket, iteration, enrichedUsage);
        usageResult = {
          promptTokens: event.usage.promptTokens,
          completionTokens: event.usage.completionTokens,
          totalTokens: event.usage.totalTokens,
          cachedTokens: event.usage.cachedTokens,
        };
        const elapsed = (Date.now() - streamStart) / 1000;
        statusTracker?.update({
          throughput: elapsed > 0 ? (event.usage.completionTokens ?? 0) / elapsed : undefined,
        });
      }
    }
  } finally {
    clearInterval(heartbeatInterval);
  }

  const flushedContent = contentSanitizer.flush();
  if (flushedContent) {
    hasContentEmitted = true;
    await emitter.emitContent(onPacket, iteration, flushedContent);
  }

  logger.info(
    `[processStreamEvents] Done — hasToolCall=${!!pendingToolCall}, contentLen=${assistantContent.length}, reasoningLen=${reasoningContent.length}, hasContentEmitted=${hasContentEmitted}`,
  );
  return { assistantContent, reasoningContent, pendingToolCall, hasContentEmitted, usage: usageResult };
}
