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
  private summaryAnchor: string | null = null;

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
      ...(this.summaryAnchor ? [new SystemMessage(`[HISTORICAL SUMMARY ANCHOR]\n${this.summaryAnchor}`)] : []),
      ...canonicalMessages,
    ];
  }

  public shouldCompact(currentTokens: number, maxContextTokens: number): boolean {
    if (!this.config.enabled || !this.config.enableAutoCompaction) {
      return false;
    }
    return currentTokens >= maxContextTokens * this.config.compactionThresholdRatio;
  }

  public applyCompaction(stateMessages: BaseMessage[], newSummary: string): BaseMessage[] {
    this.summaryAnchor = newSummary;
    return stateMessages.slice(-this.config.keepLastTurnsCount);
  }

  public setSummaryAnchor(summary: string): void {
    this.summaryAnchor = summary;
  }

  public getSummaryAnchor(): string | null {
    return this.summaryAnchor;
  }

  public getConfig(): ContextOptimizationConfig {
    return { ...this.config };
  }

  public estimateTokens(messages: BaseMessage[]): number {
    return messages.reduce((acc, m) => acc + Math.ceil((m.content as string)?.length ?? 0 / 4), 0);
  }
}
