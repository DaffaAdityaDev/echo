import type { Message, StreamPacket } from "../../../types";
import type { StreamHandlerOptions, StreamStore } from "./types";

export function handleUsage(
  lastMessage: Message,
  data: StreamPacket & { type: "usage" },
  store: StreamStore,
  _opts: StreamHandlerOptions,
): void {
  if (data.usage) {
    lastMessage.usage = data.usage;
    store.setCumulativeUsage(data.usage);
  }
}

export function handleTokenMetrics(
  _lastMessage: Message,
  data: StreamPacket & { type: "token_metrics" },
  store: StreamStore,
  _opts: StreamHandlerOptions,
): void {
  if (data.payload) {
    store.setCumulativeUsage({
      promptTokens: data.payload.promptTokens,
      completionTokens: data.payload.completionTokens,
      totalTokens: data.payload.totalTokens,
      cachedTokens: data.payload.cachedTokens,
    });
  }
}
