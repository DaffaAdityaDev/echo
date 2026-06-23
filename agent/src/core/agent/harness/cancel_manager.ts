import { Redis } from 'ioredis';
import { ENV } from '../../../config/env';
import { logger } from '../../../shared/utils/logger';

export class CancellationManager {
    private static instance: CancellationManager;
    private controllers = new Map<string, AbortController>();
    private subClient: Redis | null = null;

    private constructor() {
        if (ENV.REDIS_URL && ENV.AGENT_RUNTIME_MODE === 'saas') {
            this.subClient = new Redis(ENV.REDIS_URL, { maxRetriesPerRequest: null });
            this.subClient.on('error', (err) => {
                logger.error('CancellationManager: Redis sub client error:', err);
            });
            this.initRedisListener();
        }
    }

    public static getInstance(): CancellationManager {
        if (!CancellationManager.instance) {
            CancellationManager.instance = new CancellationManager();
        }
        return CancellationManager.instance;
    }

    private initRedisListener() {
        if (!this.subClient) return;
        this.subClient.psubscribe('control:cancel:*');
        this.subClient.on('pmessage', (_pattern, channel, _message) => {
            // Channel format: control:cancel:<missionId>
            const parts = channel.split(':');
            const missionId = parts[parts.length - 1];
            if (missionId) {
                logger.info(`CancellationManager: Received remote cancel signal for mission ${missionId}`);
                this.cancelLocal(missionId);
            }
        });
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
