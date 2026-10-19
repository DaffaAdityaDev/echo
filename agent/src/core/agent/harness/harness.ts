import type { RestToolConfig } from "../../../infrastructure/transports/rest/types";
import type { AgentState, HarnessFeatureToggles, LLMProvider, ToolDefinition } from "../../../shared/types";
import type { BehaviorPrompt } from "../prompts";
import { cancellationManager } from "./cancel-manager";
import { HARNESS_CONFIG } from "./constants";
import { ContentSanitizer } from "./content-sanitizer";
import { ContextManager } from "./context-manager";
import { HarnessEventEmitter } from "./events";
import { HitlGuard } from "./hitl-guard";
import { LoopDetector } from "./loop-detector";
import { MissionRunner } from "./mission-runner";
import { RecoveryHandler, type StrategyRef } from "./recovery";
import type { AgentStatusTracker } from "./status-tracker";
import { ToolExecutor } from "./tool-executor";
import { TurnRunner } from "./turn-runner";
import { DEFAULT_HARNESS_TOGGLES, type HarnessConfig, type HarnessEvent, type HarnessRuntimeConfig } from "./types";

/** Merges each toggle section individually so a partial section keeps the remaining defaults. */
export function mergeFeatureToggles(overrides?: Partial<HarnessFeatureToggles>): HarnessFeatureToggles {
  const defaults = DEFAULT_HARNESS_TOGGLES;

  return {
    loopDetection: { ...defaults.loopDetection, ...overrides?.loopDetection },
    budgetMonitor: { ...defaults.budgetMonitor, ...overrides?.budgetMonitor },
    systemNotices: { ...defaults.systemNotices, ...overrides?.systemNotices },
    hitlGuard: { ...defaults.hitlGuard, ...overrides?.hitlGuard },
    contextOptimization: { ...defaults.contextOptimization, ...overrides?.contextOptimization },
  };
}

export class NlahHarness {
  private provider: LLMProvider;
  private strategyRef: StrategyRef;
  private missionId: string;
  private tenantId: string;
  private delegationDepth: number;
  private explicitTools?: ToolDefinition[];
  private restTools: RestToolConfig[] = [];
  private skills?: string[];
  private behaviorPrompt: BehaviorPrompt | null = null;
  private compressionEnabled = true;
  private pacingEnabled = true;
  private pacingForced = false;
  private loopDetectionEnabled = true;
  private harnessConfig?: HarnessRuntimeConfig;
  private statusTracker?: AgentStatusTracker;

  private featureToggles: HarnessFeatureToggles;
  private loopDetector: LoopDetector;
  private hitlGuard: HitlGuard;
  private contentSanitizer: ContentSanitizer;
  private contextManager: ContextManager;
  private totalCostUsd = 0;

  private emitter: HarnessEventEmitter;
  private toolExecutor: ToolExecutor;
  private recovery: RecoveryHandler;
  private turnRunner: TurnRunner;
  private missionRunner: MissionRunner;

  constructor(options: HarnessConfig) {
    this.provider = options.provider;
    this.strategyRef = { current: options.strategy };
    this.missionId = options.missionId || crypto.randomUUID();
    this.tenantId = options.tenantId || HARNESS_CONFIG.DEFAULT_TENANT_ID;
    this.delegationDepth = options.delegationDepth ?? 0;
    this.explicitTools = options.tools;
    this.restTools = options.restTools ?? [];
    this.skills = options.skills;
    this.behaviorPrompt = options.behaviorPrompt ?? null;
    this.harnessConfig = options.harnessConfig;
    this.totalCostUsd = options.initialCostUsd ?? 0;

    this.featureToggles = mergeFeatureToggles(options.harnessConfig);
    this.loopDetector = new LoopDetector(this.featureToggles.loopDetection);
    this.hitlGuard = new HitlGuard(this.featureToggles.hitlGuard);
    this.contextManager = new ContextManager(this.featureToggles.contextOptimization);
    this.contentSanitizer = new ContentSanitizer();

    this.emitter = new HarnessEventEmitter({
      getMissionId: () => this.missionId,
      getStatusTracker: () => this.statusTracker,
      systemNoticesEnabled: this.featureToggles.systemNotices.enabled,
    });
    this.toolExecutor = new ToolExecutor({
      provider: this.provider,
      delegationDepth: this.delegationDepth,
      harnessConfig: this.harnessConfig,
      getPacingForced: () => this.pacingForced,
      getStatusTracker: () => this.statusTracker,
      emitter: this.emitter,
      addTotalCostUsd: (stepCost: number) => {
        this.totalCostUsd += stepCost;
      },
    });
    this.recovery = new RecoveryHandler({
      provider: this.provider,
      strategyRef: this.strategyRef,
      getCompressionEnabled: () => this.compressionEnabled,
      behaviorPrompt: this.behaviorPrompt,
      emitter: this.emitter,
      addTotalCostUsd: (stepCost: number) => {
        this.totalCostUsd += stepCost;
      },
      getSignal: () => cancellationManager.getSignal(this.missionId),
    });
    this.turnRunner = new TurnRunner({
      provider: this.provider,
      strategyRef: this.strategyRef,
      emitter: this.emitter,
      recovery: this.recovery,
      contextManager: this.contextManager,
      contentSanitizer: this.contentSanitizer,
      loopDetector: this.loopDetector,
      hitlGuard: this.hitlGuard,
      toolExecutor: this.toolExecutor,
      featureToggles: this.featureToggles,
      harnessConfig: this.harnessConfig,
      tenantId: this.tenantId,
      restTools: this.restTools,
      delegationDepth: this.delegationDepth,
      behaviorPrompt: this.behaviorPrompt,
      getMissionId: () => this.missionId,
      getPacingEnabled: () => this.pacingEnabled,
      getPacingForced: () => this.pacingForced,
      setPacingForced: (value: boolean) => {
        this.pacingForced = value;
      },
      getLoopDetectionEnabled: () => this.loopDetectionEnabled,
      getTotalCostUsd: () => this.totalCostUsd,
      addTotalCostUsd: (stepCost: number) => {
        this.totalCostUsd += stepCost;
      },
      getStatusTracker: () => this.statusTracker,
    });
    this.missionRunner = new MissionRunner({
      provider: this.provider,
      strategyRef: this.strategyRef,
      emitter: this.emitter,
      harnessConfig: this.harnessConfig,
      featureToggles: this.featureToggles,
      tenantId: this.tenantId,
      explicitTools: this.explicitTools,
      skills: this.skills,
      delegationDepth: this.delegationDepth,
      behaviorPrompt: this.behaviorPrompt,
      turnRunner: this.turnRunner,
      getMissionId: () => this.missionId,
      setMissionId: (missionId: string) => {
        this.missionId = missionId;
      },
      setStatusTracker: (statusTracker: AgentStatusTracker) => {
        this.statusTracker = statusTracker;
      },
      getTotalCostUsd: () => this.totalCostUsd,
      setCompressionEnabled: (enabled: boolean) => {
        this.compressionEnabled = enabled;
      },
      setPacingEnabled: (enabled: boolean) => {
        this.pacingEnabled = enabled;
      },
      setLoopDetectionEnabled: (enabled: boolean) => {
        this.loopDetectionEnabled = enabled;
      },
    });
  }

  public getTotalCostUsd(): number {
    return this.totalCostUsd;
  }

  public restoreLoopDetectorHistory(history: string[]): void {
    this.loopDetector.restoreHistory(history);
  }

  public async runMission(state: AgentState, onPacket: (packet: HarnessEvent) => Promise<void>, traceparent?: string) {
    return this.missionRunner.runMission(state, onPacket, traceparent);
  }
}
