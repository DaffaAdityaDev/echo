import { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { MissionPayload, ToolDefinition, LLMProvider } from '../../../../shared/types';
import { NlahHarness } from '../../../../core/agent/harness';
import { ProviderFactory } from '../../../../infrastructure/providers/factory';
import { StrategyFactory } from '../../../../core/agent/strategies/factory';
import { logger } from '../../../../shared/utils/logger';
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import { stateStorage } from '../../../../core/agent/storage/factory';
import { randomUUID } from 'node:crypto';
import { createMissionSchema } from './mission.schema';
import { mapHistoryToMessages } from '../../../../shared/utils/messages';
import { StandardContextAnchor } from '../../../../core/agent/anchors/standard';
import { VALIDATION_MESSAGES, MISSION_LOG_MESSAGES } from './mission.constants';
import { toolRegistry } from '../../../../core/agent/tools/registry';
import { SkillRegistry } from '../../../../core/agent/skills';
import { HttpStreamTransport } from './stream.transport';
import { cancellationManager } from '../../../../core/agent/harness/cancel_manager';

export class MissionController {
  public async createMission(c: Context) {
    try {
      const body = await c.req.json();
      const queryParams = c.req.query();
      const rawInput = { ...queryParams, ...body };
      
      const parseResult = createMissionSchema.safeParse(rawInput);
      if (!parseResult.success) {
        logger.error(VALIDATION_MESSAGES.VALIDATION_ERROR, parseResult.error.format());
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
      };

      const historyMessages = mapHistoryToMessages(validatedData.history ?? undefined);

      const apiKeyCleaned = validatedData.provider_config.api_key?.trim();
      const llmProvider = ProviderFactory.fromConfig({
        ...validatedData.provider_config,
        api_key: apiKeyCleaned ? apiKeyCleaned : undefined
      });
      const executionStrategy = StrategyFactory.create(payload.strategy);

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
            new StandardContextAnchor().build(),
            ...historyMessages,
            new HumanMessage(payload.prompt)
          ]
        };
      }

      const explicitFeatures = validatedData.features ?? undefined;
      let resolvedTools: ToolDefinition[] | undefined;

      if (explicitFeatures !== undefined) {
        resolvedTools = await toolRegistry.resolveTools(explicitFeatures);
      }

      if (explicitFeatures === undefined && validatedData.skills && validatedData.skills.length > 0) {
        const skillsRegistry = SkillRegistry.getInstance();
        const preferredToolNames = new Set<string>();

        for (const skillName of validatedData.skills) {
          const skill = skillsRegistry.getSkill(skillName);
          if (skill?.preferredTools) {
            for (const tool of skill.preferredTools) {
              preferredToolNames.add(tool);
            }
          }
        }

        if (preferredToolNames.size > 0) {
          resolvedTools = await toolRegistry.resolveTools([...preferredToolNames]);
        }
      }

      try {
        await llmProvider.validate?.();
      } catch (validateErr: any) {
        logger.error(`Provider pre-validation failed: ${validateErr.message}`);
        return c.json({
          error: 'Provider unreachable',
          details: validateErr.message
        }, 502);
      }

      return streamSSE(c, async (streamInstance) => {
        const transport = new HttpStreamTransport(streamInstance);

        const signal = cancellationManager.register(missionId);
        streamInstance.onAbort(() => {
          cancellationManager.cancelLocal(missionId);
        });

        const harness = new NlahHarness({
          missionId,
          tenantId: payload.tenant.tenantId,
          provider: llmProvider,
          strategy: executionStrategy,
          tools: resolvedTools,
          skills: validatedData.skills ?? undefined,
          harnessConfig: validatedData.config.harnessConfig,
          delegationDepth: validatedData.config.harness.delegationDepth
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
        } catch (streamErr: any) {
          logger.error(`Stream execution failed: ${streamErr.message}`);
          try {
            await transport.send({
              type: 'error',
              missionId,
              step: 0,
              content: streamErr.message,
              code: 'STREAM_EXECUTION_ERROR'
            });
          } catch (sendErr) {
            logger.warn(`Failed to send error packet to client: ${sendErr}`);
          }
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
