import { logger } from '../../../shared/utils/logger';

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