import type Redis from "ioredis";
import { getRedisClient, isRedisAvailable } from "../../../../infrastructure/cache/redis";
import { logger } from "../../../../shared/utils/logger";
import type { StreamPacket } from "./stream.transport";

const STREAM_KEY_PREFIX = "mission:events:";
const STREAM_TTL_SECONDS = 86400;
const STREAM_MAXLEN = 2000;
const FIELD_NAME = "p";

export interface MissionEvent {
  sid: string;
  packet: StreamPacket;
}

function streamKey(missionId: string): string {
  return `${STREAM_KEY_PREFIX}${missionId}`;
}

export async function recordEvent(missionId: string, packet: StreamPacket): Promise<void> {
  const redis = getRedisClient();
  if (!redis || !isRedisAvailable()) {
    return;
  }
  try {
    const key = streamKey(missionId);
    await redis.xadd(key, "MAXLEN", "~", STREAM_MAXLEN, "*", FIELD_NAME, JSON.stringify(packet));
    await redis.expire(key, STREAM_TTL_SECONDS);
  } catch (err) {
    logger.warn(
      `Mission stream: failed to record event for ${missionId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getHistory(missionId: string, after?: string): Promise<MissionEvent[]> {
  const redis = getRedisClient();
  if (!redis || !isRedisAvailable()) {
    return [];
  }
  try {
    const start = after ? `(${after}` : "-";
    const entries = await redis.xrange(streamKey(missionId), start, "+");
    return entries.map((entry: [string, string[]]) => {
      const [sid, fields] = entry;
      const idx = fields.findIndex((field: string) => field === FIELD_NAME);
      const raw = idx >= 0 ? fields[idx + 1] : undefined;
      return { sid, packet: parsePacket(raw) };
    });
  } catch (err) {
    logger.warn(
      `Mission stream: failed to read history for ${missionId}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

export async function getLastEvent(missionId: string): Promise<MissionEvent | null> {
  const redis = getRedisClient();
  if (!redis || !isRedisAvailable()) {
    return null;
  }
  try {
    const entries = await redis.xrevrange(streamKey(missionId), "+", "-", "COUNT", 1);
    if (entries.length === 0) return null;
    const [sid, fields] = entries[0] as [string, string[]];
    const idx = fields.findIndex((field: string) => field === FIELD_NAME);
    const raw = idx >= 0 ? fields[idx + 1] : undefined;
    return { sid, packet: parsePacket(raw) };
  } catch (err) {
    logger.warn(
      `Mission stream: failed to read tail for ${missionId}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

export function subscribe(missionId: string, cb: (event: MissionEvent) => void, lastSid?: string): () => void {
  const redis = getRedisClient();
  if (!redis || !isRedisAvailable()) {
    return () => {};
  }

  let active = true;
  // Resume from the last entry already replayed (exclusive), so events recorded
  // between the history read and the first XREAD are not skipped.
  let lastId = lastSid ?? "$";
  const key = streamKey(missionId);

  const loop = async (): Promise<void> => {
    while (active) {
      try {
        const result = await redis.xread("COUNT", 100, "BLOCK", 5000, "STREAMS", key, lastId);
        if (!active) return;
        if (!result) {
          await sleep(100);
          continue;
        }

        for (const [, entries] of result) {
          for (const entry of entries) {
            const [sid, fields] = entry as [string, string[]];
            const idx = fields.findIndex((field: string) => field === FIELD_NAME);
            const raw = idx >= 0 ? fields[idx + 1] : undefined;
            cb({ sid, packet: parsePacket(raw) });
            lastId = sid;
          }
        }
      } catch (err) {
        if (!active) return;
        logger.warn(
          `Mission stream: subscribe loop error for ${missionId}: ${err instanceof Error ? err.message : String(err)}`,
        );
        await sleep(1000);
      }
    }
  };

  void loop();
  return () => {
    active = false;
  };
}

export function isTerminalPacket(packet: StreamPacket): boolean {
  return packet.type === "mission_completed" || packet.type === "error";
}

function parsePacket(raw: string | undefined): StreamPacket {
  if (!raw) return { type: "unknown" };
  try {
    return JSON.parse(raw) as StreamPacket;
  } catch {
    return { type: "unknown", raw };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type { Redis };
