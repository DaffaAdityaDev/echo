import { type BaseMessage, SystemMessage } from "@langchain/core/messages";

export interface ContextOptimizationConfig {
  enabled: boolean;
  enablePrefixCachingLayout: boolean;
  enableAutoCompaction: boolean;
  compactionThresholdRatio: number;
  keepLastTurnsCount: number;
}

export class ContextManager {
  private config: ContextOptimizationConfig;

  constructor(config?: Partial<ContextOptimizationConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      enablePrefixCachingLayout: config?.enablePrefixCachingLayout ?? true,
      enableAutoCompaction: config?.enableAutoCompaction ?? true,
      compactionThresholdRatio: config?.compactionThresholdRatio ?? 0.7,
      keepLastTurnsCount: config?.keepLastTurnsCount ?? 4,
    };
  }

  public prepareMessagesPayload(
    staticSystemPrompt: string,
    dynamicEnvContext: string,
    canonicalMessages: BaseMessage[],
  ): BaseMessage[] {
    if (!this.config.enabled || !this.config.enablePrefixCachingLayout) {
      return [new SystemMessage(`${staticSystemPrompt}\n\n${dynamicEnvContext}`), ...canonicalMessages];
    }

    return [
      new SystemMessage(staticSystemPrompt),
      new SystemMessage(`[ENVIRONMENT CONTEXT]\n${dynamicEnvContext}`),
      ...canonicalMessages,
    ];
  }
}
