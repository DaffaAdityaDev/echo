import { logger } from "../../../shared/utils/logger";

const CANCELLED_IDS_CAP = 500;

export class CancellationManager {
  private static instance: CancellationManager;
  private controllers = new Map<string, AbortController>();
  // Maps mission ID to the cancel timestamp. Bounded so a burst of cancelled
  // missions cannot grow the map without limit; the oldest entries are pruned
  // once the cap is exceeded.
  private cancelledIds = new Map<string, number>();

  private constructor() {}

  public static getInstance(): CancellationManager {
    if (!CancellationManager.instance) {
      CancellationManager.instance = new CancellationManager();
    }
    return CancellationManager.instance;
  }

  public register(missionId: string): AbortSignal {
    const controller = new AbortController();
    this.controllers.set(missionId, controller);
    return controller.signal;
  }

  public unregister(missionId: string) {
    this.controllers.delete(missionId);
  }

  public cancelLocal(missionId: string) {
    // Mark unconditionally: a cancel that arrives before the mission registers
    // (e.g. during createMission) must still stop it — the harness checks
    // isCancelled before the first LLM call.
    this.cancelledIds.set(missionId, Date.now());
    this.pruneCancelledIds();
    const controller = this.controllers.get(missionId);
    if (!controller) {
      logger.info(`CancellationManager: Marking mission ${missionId} cancelled (no active controller)`);
      return;
    }
    logger.info(`CancellationManager: Cancelling mission ${missionId} locally`);
    controller.abort();
    this.controllers.delete(missionId);
  }

  private pruneCancelledIds() {
    if (this.cancelledIds.size <= CANCELLED_IDS_CAP) return;
    let overflow = this.cancelledIds.size - CANCELLED_IDS_CAP;
    for (const missionId of this.cancelledIds.keys()) {
      if (overflow <= 0) break;
      this.cancelledIds.delete(missionId);
      overflow--;
    }
  }

  public isAborted(missionId: string): boolean {
    return this.controllers.get(missionId)?.signal.aborted || false;
  }

  public getSignal(missionId: string): AbortSignal | undefined {
    return this.controllers.get(missionId)?.signal;
  }

  public isCancelled(missionId: string): boolean {
    return this.cancelledIds.has(missionId);
  }

  public clearCancelled(missionId: string) {
    this.cancelledIds.delete(missionId);
  }
}

export const cancellationManager = CancellationManager.getInstance();
