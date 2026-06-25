import { logger } from '../../../shared/utils/logger';

export class CancellationManager {
    private static instance: CancellationManager;
    private controllers = new Map<string, AbortController>();

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
        const controller = this.controllers.get(missionId);
        if (controller) {
            logger.info(`CancellationManager: Cancelling mission ${missionId} locally`);
            controller.abort();
            this.controllers.delete(missionId);
        }
    }

    public isAborted(missionId: string): boolean {
        return this.controllers.get(missionId)?.signal.aborted || false;
    }
}

export const cancellationManager = CancellationManager.getInstance();