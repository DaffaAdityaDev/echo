import { logger } from '../../../shared/utils/logger';
import { redisClient } from '../../../infrastructure/redis';

export interface StreamTransport {
    send(packet: any): Promise<void>;
}

export class HttpStreamTransport implements StreamTransport {
    private seq = 0;
    constructor(private streamInstance: any) {}

    async send(packet: any): Promise<void> {
        this.seq++;
        const enriched = {
            ...packet,
            seq: this.seq,
            timestamp: Date.now()
        };
        try {
            await this.streamInstance.writeSSE({
                data: JSON.stringify(enriched)
            });
        } catch (err: any) {
            logger.warn(`HttpStreamTransport: Failed to write packet to stream: ${err.message}`);
        }
    }
}

export class RedisStreamTransport implements StreamTransport {
    private seq = 0;
    constructor(private missionId: string) {}

    async send(packet: any): Promise<void> {
        if (!redisClient) {
            logger.warn(`RedisStreamTransport: Redis client is offline, dropping packet for mission ${this.missionId}`);
            return;
        }
        this.seq++;
        const enriched = {
            ...packet,
            seq: this.seq,
            timestamp: Date.now()
        };
        try {
            // Add packet to Redis Stream with key stream:<missionId>
            const streamKey = `stream:${this.missionId}`;
            await redisClient.xadd(
                streamKey,
                '*',
                'packet',
                JSON.stringify(enriched)
            );
            // Also publish for real-time pub/sub fallback if required
            await redisClient.publish(streamKey, JSON.stringify(enriched));
        } catch (err: any) {
            logger.error(`RedisStreamTransport: Failed to write to Redis Stream: ${err.message}`);
        }
    }
}

// MultiStreamTransport sends to both HTTP SSE and Redis Stream
export class MultiStreamTransport implements StreamTransport {
    constructor(private transports: StreamTransport[]) {}

    async send(packet: any): Promise<void> {
        await Promise.all(this.transports.map(t => t.send(packet)));
    }
}
