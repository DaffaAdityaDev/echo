import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type Redis from "ioredis";
import { cancellationManager, type NlahHarness } from "../../../../core/agent/harness";
import type { HarnessEvent } from "../../../../core/agent/harness/types";
import { getRedisClient, isRedisAvailable } from "../../../../infrastructure/cache/redis";
import { ERROR_STATUS } from "../../../../shared/constants/errors";
import { HTTP_STATUS } from "../../../../shared/constants/http";
import type { AgentState } from "../../../../shared/types";
import { logger } from "../../../../shared/utils/logger";
import { MISSION_ERROR_MESSAGES, STREAM_CONSTANTS } from "./mission.constants";
import { HttpStreamTransport, type StreamPacket } from "./stream.transport";

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

export async function streamHarnessExecution(
  c: Context,
  opts: {
    missionId: string;
    state: AgentState;
    harness: NlahHarness;
    executionLog: string;
    sendErrorLog: string;
  },
) {
  return streamSSE(c, async (streamInstance) => {
    const transport = new HttpStreamTransport(streamInstance);

    const signal = cancellationManager.register(opts.missionId);
    streamInstance.onAbort(() => {
      cancellationManager.cancelLocal(opts.missionId);
    });

    let completedCleanly = false;

    try {
      await opts.harness.runMission(opts.state, async (packet: HarnessEvent) => {
        if (signal.aborted) {
          throw new Error(STREAM_CONSTANTS.CANCELLED_MESSAGE);
        }
        const enriched = await transport.send(packet);
        await recordEvent(opts.missionId, enriched);
      });
      completedCleanly = true;
    } catch (streamErr: unknown) {
      const errorMessage = streamErr instanceof Error ? streamErr.message : String(streamErr);
      logger.error(`${opts.executionLog} ${errorMessage}`);
      try {
        const errorPacket = {
          type: ERROR_STATUS,
          missionId: opts.missionId,
          step: STREAM_CONSTANTS.ERROR_STEP,
          content: errorMessage,
          code: STREAM_CONSTANTS.ERROR_CODE,
        };
        await transport.send(errorPacket);
        await recordEvent(opts.missionId, errorPacket);
      } catch (sendErr) {
        logger.warn(`${opts.sendErrorLog} ${sendErr}`);
      }
    } finally {
      cancellationManager.unregister(opts.missionId);
      // Only a clean completion gets the terminal "completed" marker. A
      // cancelled/errored run already recorded an error packet, which replay
      // treats as terminal — stamping it "completed" too would make a
      // cancelled mission replay as a success.
      if (completedCleanly) {
        await recordEvent(opts.missionId, {
          type: "mission_completed",
          missionId: opts.missionId,
        });
      }
    }
  });
}

export async function streamMissionLogs(c: Context) {
  const missionId = c.req.param("id") as string;
  if (!missionId) {
    return c.json({ error: MISSION_ERROR_MESSAGES.MISSION_ID_REQUIRED }, HTTP_STATUS.BAD_REQUEST);
  }

  if (!isRedisAvailable()) {
    return c.json({ error: MISSION_ERROR_MESSAGES.STREAM_UNAVAILABLE }, HTTP_STATUS.SERVICE_UNAVAILABLE);
  }

  const after = c.req.query("after") || c.req.header("Last-Event-ID") || undefined;

  return streamSSE(c, async (streamInstance) => {
    let cleanup = () => {};
    let finished = false;
    let resolveDone = () => {};

    const finish = () => {
      if (finished) return;
      finished = true;
      cleanup();
    };

    const done = () => {
      finish();
      resolveDone();
    };

    const write = async (event: { sid: string; packet: StreamPacket }) => {
      await streamInstance.writeSSE({ data: JSON.stringify({ ...event.packet, sid: event.sid }) });
      if (isTerminalPacket(event.packet)) {
        done();
      }
    };

    const history = await getHistory(missionId, after);
    for (const event of history) {
      if (finished) return;
      await write(event);
    }
    if (finished) return;

    // Stream already ended (terminal marker before the cursor): close instead
    // of blocking forever on subscribe.
    const lastEvent = await getLastEvent(missionId);
    if (lastEvent && isTerminalPacket(lastEvent.packet)) {
      return;
    }

    // A stream with no terminal marker is either a mission that just started
    // (first event not yet recorded), one whose Redis stream expired after the
    // 24h TTL, or one whose agent died mid-run. None of these will produce a
    // terminal packet, so close after an idle window instead of blocking
    // forever:
    //   - Empty history: a single-shot window for the expired/TTL case. The
    //     first live event proves the mission is genuinely running, so it
    //     cancels the timer (a live mission must never be cut off on silence).
    //   - Partial history: a sliding window reset on every live event, so a
    //     mission whose agent died mid-run closes instead of hanging forever.
    const idleMs =
      history.length === 0
        ? (emptyStreamIdleMs ?? STREAM_CONSTANTS.EMPTY_STREAM_IDLE_MS)
        : (partialHistoryIdleMs ?? STREAM_CONSTANTS.PARTIAL_HISTORY_IDLE_MS);

    let idleTimer: NodeJS.Timeout | undefined;
    const scheduleIdleClose = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(done, idleMs);
    };
    const cancelIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = undefined;
      }
    };

    const unsubscribe = subscribe(
      missionId,
      (event) => {
        if (history.length === 0) {
          cancelIdleTimer();
        } else {
          scheduleIdleClose();
        }
        write(event).catch(done);
      },
      history.length > 0 ? history[history.length - 1].sid : undefined,
    );

    scheduleIdleClose();

    // Replayed history is done; signal the client so it can switch from
    // replay (skip already-applied content) to live (apply content deltas).
    // Sent before the first live event can be delivered: subscribe's XREAD
    // callback is asynchronous, and the history was already written above.
    await streamInstance.writeSSE({ data: JSON.stringify({ type: STREAM_CONSTANTS.REPLAY_DONE_TYPE }) });

    const heartbeat = setInterval(() => {
      streamInstance.write(": heartbeat\n\n").catch(done);
    }, STREAM_CONSTANTS.HEARTBEAT_INTERVAL_MS);

    cleanup = () => {
      clearInterval(heartbeat);
      cancelIdleTimer();
      unsubscribe();
    };

    streamInstance.onAbort(done);
    c.req.raw.signal.addEventListener("abort", done);

    await new Promise<void>((resolve) => {
      resolveDone = resolve;
    });
  });
}

let emptyStreamIdleMs: number | null = null;
let partialHistoryIdleMs: number | null = null;

export function __setEmptyStreamIdleMsForTest(ms: number | null) {
  emptyStreamIdleMs = ms;
}

export function __setPartialHistoryIdleMsForTest(ms: number | null) {
  partialHistoryIdleMs = ms;
}

export type { Redis };
