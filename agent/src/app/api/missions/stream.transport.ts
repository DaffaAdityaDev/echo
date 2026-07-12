import { logger } from '../../../shared/utils/logger';

export class HttpStreamTransport {
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