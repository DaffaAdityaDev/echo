import { createHash } from 'node:crypto';

export interface LoopDetectorConfig {
  enabled: boolean;
  maxConsecutiveIdenticalCalls: number;
  windowSize: number;
}

export interface LoopCheckResult {
  isLoop: boolean;
  count: number;
  hash: string;
}

export class LoopDetector {
  private history: string[] = [];
  private config: LoopDetectorConfig;

  constructor(config?: Partial<LoopDetectorConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      maxConsecutiveIdenticalCalls: config?.maxConsecutiveIdenticalCalls ?? 3,
      windowSize: config?.windowSize ?? 10,
    };
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public generateHash(toolName: string, args: Record<string, unknown>): string {
    const canonicalArgs = JSON.stringify(args, Object.keys(args ?? {}).sort());
    return createHash('md5').update(`${toolName}:${canonicalArgs}`).digest('hex');
  }

  public recordAndCheck(toolName: string, args: Record<string, unknown>): LoopCheckResult {
    if (!this.config.enabled) {
      return { isLoop: false, count: 0, hash: '' };
    }

    const hash = this.generateHash(toolName, args);
    this.history.push(hash);

    if (this.history.length > this.config.windowSize) {
      this.history.shift();
    }

    let count = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i] === hash) {
        count++;
      } else {
        break;
      }
    }

    return {
      isLoop: count >= this.config.maxConsecutiveIdenticalCalls,
      count,
      hash,
    };
  }

  public getHistory(): string[] {
    return [...this.history];
  }

  public restoreHistory(previousHistory: string[]): void {
    this.history = [...previousHistory];
  }

  public clear(): void {
    this.history = [];
  }
}
