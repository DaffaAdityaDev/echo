import { logger } from "../../../../shared/utils/logger";

export interface StreamPacket {
  type: string;
  [key: string]: unknown;
}

export class HttpStreamTransport {
  private seq = 0;
  constructor(private streamInstance: { writeSSE: (packet: { data: string }) => unknown }) {}

  async send(packet: StreamPacket): Promise<StreamPacket> {
    this.seq++;
    const enriched = {
      ...packet,
      seq: this.seq,
      timestamp: Date.now(),
    };
    try {
      await this.streamInstance.writeSSE({
        data: JSON.stringify(enriched),
      });
    } catch (err: unknown) {
      logger.warn(
        `HttpStreamTransport: Failed to write packet to stream: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return enriched;
  }
}
