import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { cancellationManager, type NlahHarness } from "../../../../core/agent/harness";
import { PACKET_TYPES } from "../../../../core/agent/harness/constants";
import type { HarnessEvent } from "../../../../core/agent/harness/types";
import { classifyProviderError } from "../../../../infrastructure/providers/utils/upstream-error";
import type { AgentState } from "../../../../shared/types";
import { HTTP_STATUS } from "../../../../shared/constants/http";
import { logger } from "../../../../shared/utils/logger";
import { MISSION_ERROR_MESSAGES, STREAM_CONSTANTS } from "./mission.constants";
import { HttpStreamTransport } from "./stream.transport";

type StreamErrorPacket = {
  type: string;
  missionId: string;
  step: number;
  content: string;
  code: string;
  detail?: string;
  status?: number;
};

/** Claims the mission's single active-run slot; null when a run for it is already in progress. */
export function reserveMissionRun(missionId: string): AbortSignal | null {
  if (cancellationManager.isActive(missionId)) return null;

  return cancellationManager.register(missionId);
}

export async function streamHarnessExecution(
  c: Context,
  opts: {
    missionId: string;
    state: AgentState;
    harness: NlahHarness;
    executionLog: string;
    sendErrorLog: string;
    /** A run slot already claimed with reserveMissionRun; the stream takes ownership of releasing it. */
    reservedSignal?: AbortSignal;
  },
) {
  const signal = opts.reservedSignal ?? reserveMissionRun(opts.missionId);

  if (!signal) {
    return c.json({ error: MISSION_ERROR_MESSAGES.MISSION_ALREADY_RUNNING }, HTTP_STATUS.CONFLICT);
  }

  return streamSSE(c, async (streamInstance) => {
    const transport = new HttpStreamTransport(streamInstance);

    streamInstance.onAbort(() => {
      cancellationManager.cancelLocal(opts.missionId);
    });

    try {
      await opts.harness.runMission(opts.state, async (packet: HarnessEvent) => {
        if (signal.aborted) {
          throw new Error(STREAM_CONSTANTS.CANCELLED_MESSAGE);
        }

        await transport.send(packet);
      });
    } catch (streamErr: unknown) {
      const upstream = classifyProviderError(streamErr);

      const errorMessage = upstream
        ? upstream.message
        : streamErr instanceof Error
          ? streamErr.message
          : String(streamErr);

      logger.error(`${opts.executionLog} ${errorMessage}`, upstream ? { detail: upstream.detail } : undefined);

      try {
        const errorPacket: StreamErrorPacket = {
          type: PACKET_TYPES.ERROR,
          missionId: opts.missionId,
          step: STREAM_CONSTANTS.ERROR_STEP,
          content: errorMessage,
          code: upstream?.code ?? STREAM_CONSTANTS.ERROR_CODE,
        };

        if (upstream?.detail) {
          errorPacket.detail = upstream.detail;
        }

        if (upstream?.status !== undefined) {
          errorPacket.status = upstream.status;
        }

        await transport.send(errorPacket);
      } catch (sendErr) {
        logger.warn(`${opts.sendErrorLog} ${sendErr}`);
      }
    } finally {
      cancellationManager.unregister(opts.missionId, signal);
    }
  });
}
