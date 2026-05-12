import { Context } from "hono";
import { streamText } from "hono/streaming";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AgentHarness, ProviderFactory, toolRegistry, StrategyFactory } from "../../harness";
import { logger } from "../../shared/utils/logger";
import { generateMissionSchema } from "./mission.schema";
import { ValidationError } from "../../shared/utils/errors";

export class MissionController {
    async generateMission(c: Context) {
        const body = await c.req.json();
        const result = generateMissionSchema.safeParse(body);

        if (!result.success) {
            logger.warn('Validation failed for generate-mission', result.error.format());
            throw new ValidationError("Invalid request data", result.error.issues);
        }

        const { message, model, history } = result.data;
        
        const targetModel = model || "deepseek-r1-distill-llama-8b";
        const baseURL = process.env.LLM_MODEL_API_URL || "http://localhost:1234/v1";
        
        logger.info(`Orchestrating mission`, { targetModel });

        // Reconstruct LangChain message objects from the conversation history
        const historyMessages = (history || []).map((m: { role: string; content: string }) =>
            m.role === "user" || m.role === "human" ? new HumanMessage(m.content) : new AIMessage(m.content)
        );

        return streamText(c, async (stream) => {
            try {
                // The factory handles all the complexity of choosing the right strategy
                const provider = ProviderFactory.create(targetModel, baseURL);
                
                await toolRegistry.autoload();

                // Select strategy based on requested mode
                const mode = c.req.query("mode") || "standard";
                const strategy = StrategyFactory.create(mode);

                const harness = new AgentHarness({
                    provider,
                    strategy
                });

                await harness.runMission(message, historyMessages, async (packet: any) => {
                    await stream.write(JSON.stringify(packet) + "\n");
                });

            } catch (error: any) {
                logger.error('Mission failed during execution', error);
                await stream.write(JSON.stringify({ 
                    type: 'error',
                    content: 'An internal error occurred during mission orchestration.',
                    meta: { message: error.message }
                }) + "\n");
            }
        });
    }
}

export const missionController = new MissionController();
