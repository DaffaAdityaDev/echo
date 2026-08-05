import { z } from "zod";
import type { Observation, ToolDefinition } from "../../../../../shared/types";
import { logger } from "../../../../../shared/utils/logger";
import { OPERATION_STATUS } from "../../../harness/constants";
import { PLANNING_CONFIG, PLANNING_LOGS, PLANNING_TEMPLATES, SCHEMA_DESC } from "./constants";

export const writeTodosTool: ToolDefinition = {
  name: PLANNING_CONFIG.NAME,
  description: PLANNING_CONFIG.DESCRIPTION,
  keywords: [...PLANNING_CONFIG.KEYWORDS],
  schema: z.object({
    todos: z
      .array(
        z.object({
          id: z.string().describe(SCHEMA_DESC.TODO_ID),
          description: z.string().describe(SCHEMA_DESC.TODO_DESC),
          status: z.enum(PLANNING_CONFIG.STATUS_ENUM).describe(SCHEMA_DESC.TODO_STATUS),
        }),
      )
      .describe(SCHEMA_DESC.TODOS),
  }),
  execute: async (input: {
    todos: Array<{ id: string; description: string; status: string }>;
  }): Promise<Observation> => {
    try {
      logger.info(PLANNING_LOGS.UPDATING, { count: input.todos.length });
      return {
        status: OPERATION_STATUS.SUCCESS,
        summary: PLANNING_TEMPLATES.SUMMARY_SUCCESS(input.todos.length),
        data: { todos: input.todos },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(PLANNING_LOGS.FAILED, error);
      return {
        status: OPERATION_STATUS.ERROR,
        summary: `${PLANNING_LOGS.ERROR_PREFIX}: ${errorMessage}`,
        error: errorMessage,
      };
    }
  },
};

export default writeTodosTool;
