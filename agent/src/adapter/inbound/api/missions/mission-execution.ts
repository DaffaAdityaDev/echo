import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { cancellationManager, type NlahHarness } from "../../../../core/agent/harness";
import { PACKET_TYPES } from "../../../../core/agent/harness/constants";
import type { HarnessEvent } from "../../../../core/agent/harness/types";
import type { AgentState } from "../../../../shared/types";
import { logger } from "../../../../shared/utils/logger";
import { STREAM_CONSTANTS } from "./mission.constants";
import { HttpStreamTransport } from "./stream.transport";

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

    try {
      await opts.harness.runMission(opts.state, async (packet: HarnessEvent) => {
        if (signal.aborted) {
          throw new Error(STREAM_CONSTANTS.CANCELLED_MESSAGE);
        }
        await transport.send(packet);
      });
    } catch (streamErr: unknown) {
      const errorMessage = streamErr instanceof Error ? streamErr.message : String(streamErr);
      logger.error(`${opts.executionLog} ${errorMessage}`);
      try {
        const errorPacket = {
          type: PACKET_TYPES.ERROR,
          missionId: opts.missionId,
          step: STREAM_CONSTANTS.ERROR_STEP,
          content: errorMessage,
          code: STREAM_CONSTANTS.ERROR_CODE,
        };
        await transport.send(errorPacket);
      } catch (sendErr) {
        logger.warn(`${opts.sendErrorLog} ${sendErr}`);
      }
    } finally {
      cancellationManager.unregister(opts.missionId);
    }
  });
}
