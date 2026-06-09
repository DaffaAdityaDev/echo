import { Context } from 'hono';
import { stream } from 'hono/streaming';
import { MissionPayload } from '../../shared/types';
import { AgentHarness } from '../../core/agent/harness';
import { ProviderFactory } from '../../infrastructure/providers/factory';
import { StrategyFactory } from '../../core/agent/strategies/factory';
import { logger } from '../../shared/utils/logger';
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { stateStorage } from '../../core/agent/storage/factory';

export class MissionController {
  public async createMission(c: Context) {
    try {
      const body = await c.req.json();
      const { prompt, message, strategy, mode, provider, tenantId, userId, orgId, history, model } = body;

      const finalPrompt = prompt || message;
      if (!finalPrompt) {
        return c.json({ error: "Missing required prompt or message attribute" }, 400);
      }

      const normalizedTenant = tenantId || 'local-developer';
      const normalizedUser = userId || 'local-dev-user';
      const normalizedOrg = orgId || 'local-org';

      const missionId = body.missionId || crypto.randomUUID();
      const payload: MissionPayload = {
        missionId,
        tenant: { tenantId: normalizedTenant, userId: normalizedUser, orgId: normalizedOrg },
        prompt: finalPrompt,
        strategy: strategy || mode || 'react',
        provider: provider || 'openai'
      };

      // Reconstruct LangChain message objects from the conversation history
      const historyMessages = (history || []).map((m: { role: string; content: string }) =>
        m.role === "user" || m.role === "human" ? new HumanMessage(m.content) : new AIMessage(m.content)
      );

      c.header("Content-Type", "text/event-stream");
      c.header("Cache-Control", "no-cache");
      c.header("Connection", "keep-alive");

      return stream(c, async (streamInstance) => {
        const llmProvider = ProviderFactory.create(model || payload.provider, process.env.LLM_MODEL_API_URL || "http://localhost:1234/v1");
        const executionStrategy = StrategyFactory.create(payload.strategy);
        const harness = new AgentHarness({
          missionId,
          tenantId: payload.tenant.tenantId,
          provider: llmProvider,
          strategy: executionStrategy
        });

        // 5. Stateful Hydration (Smell 5) - Hydrate State before runMission
        let state = await stateStorage.get(missionId);
        if (state) {
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
                    new SystemMessage(`<context_anchor>Current_Year: 2026 | Session_Start_Location: South Jakarta</context_anchor>`),
                    ...historyMessages,
                    new HumanMessage(payload.prompt)
                ]
            };
        }

        await harness.runMission(
          state,
          async (packet: any) => {
            try {
              await streamInstance.write(`data: ${JSON.stringify(packet)}\n\n`);
            } catch (err: any) {
              logger.warn(`Failed to write packet to stream: ${err.message}`);
            }
          }
        );
      });
    } catch (error: any) {
      logger.error("Execution failure", error);
      return c.json({ error: "Execution failure", details: error.message }, 500);
    }
  }
}

export const missionController = new MissionController();
