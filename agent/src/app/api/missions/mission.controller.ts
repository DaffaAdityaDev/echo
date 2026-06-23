import { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { MissionPayload } from '../../../shared/types';
import { AgentHarness } from '../../../core/agent/harness';
import { ProviderFactory } from '../../../infrastructure/providers/factory';
import { StrategyFactory } from '../../../core/agent/strategies/factory';
import { logger } from '../../../shared/utils/logger';
import { HumanMessage } from "@langchain/core/messages";
import { stateStorage } from '../../../core/agent/storage/factory';
import { ENV } from '../../../config/env';
import { randomUUID } from 'node:crypto';
import { createMissionSchema } from './mission.schema';
import { mapHistoryToMessages } from '../../../shared/utils/messages';
import { AnchorFactory } from '../../../core/agent/anchors/factory';
import { VALIDATION_MESSAGES, MISSION_LOG_MESSAGES } from './mission.constants';
import { toolRegistry } from '../../../core/agent/tools/registry';
import { HttpStreamTransport, RedisStreamTransport, MultiStreamTransport, StreamTransport } from './stream.transport';
import { cancellationManager } from '../../../core/agent/harness/cancel_manager';

export class MissionController {
  public async createMission(c: Context) {
    try {
      const body = await c.req.json();
      
      // Boundary validation
      const parseResult = createMissionSchema.safeParse(body);
      if (!parseResult.success) {
        return c.json({
          error: VALIDATION_MESSAGES.VALIDATION_ERROR,
          details: parseResult.error.format()
        }, 400);
      }

      const validatedData = parseResult.data;
      const missionId = validatedData.missionId || randomUUID();
      
      const payload: MissionPayload = {
        missionId,
        tenant: {
          tenantId: validatedData.tenantId,
          userId: validatedData.userId,
          orgId: validatedData.orgId
        },
        prompt: validatedData.prompt,
        strategy: validatedData.strategy,
        provider: validatedData.provider
      };

      // Reconstruct LangChain message objects from the conversation history
      const historyMessages = mapHistoryToMessages(validatedData.history);

      // Performance Optimization 1: Instantiate factories early
      const llmProvider = ProviderFactory.create(validatedData.model || payload.provider, ENV.LLM_MODEL_API_URL);
      const executionStrategy = StrategyFactory.create(payload.strategy);

      // Performance Optimization 2: Read state from storage early (pre-stream)
      let state = await stateStorage.get(missionId);
      if (state) {
        state.objective = payload.prompt;
        const hasNewMessage = state.messages.some(m => m.content === payload.prompt);
        if (!hasNewMessage) {
          state.messages.push(new HumanMessage(payload.prompt));
        }
      } else {
        state = {
          missionId,
          objective: payload.prompt,
          tasks: [],
          memory: {},
          messages: [
            AnchorFactory.create().build(),
            ...historyMessages,
            new HumanMessage(payload.prompt)
          ]
        };
      }

      const resolvedTools = await toolRegistry.resolveTools(validatedData.features);

      return streamSSE(c, async (streamInstance) => {
        const transports: StreamTransport[] = [new HttpStreamTransport(streamInstance)];
        if (ENV.AGENT_RUNTIME_MODE === 'saas') {
          transports.push(new RedisStreamTransport(missionId));
        }
        const transport = new MultiStreamTransport(transports);

        const signal = cancellationManager.register(missionId);

        const harness = new AgentHarness({
          missionId,
          tenantId: payload.tenant.tenantId,
          provider: llmProvider,
          strategy: executionStrategy,
          tools: resolvedTools
        });

        try {
          await harness.runMission(
            state,
            async (packet: any) => {
              if (signal.aborted) {
                throw new Error("Mission cancelled by client disconnect");
              }
              await transport.send(packet);
            }
          );
        } finally {
          cancellationManager.unregister(missionId);
        }
      });
    } catch (error: any) {
      logger.error(MISSION_LOG_MESSAGES.EXECUTION_FAILURE, error);
      return c.json({ error: MISSION_LOG_MESSAGES.EXECUTION_FAILURE, details: error.message }, 500);
    }
  }
}

export const missionController = new MissionController();
