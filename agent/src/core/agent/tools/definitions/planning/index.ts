import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Observation, ToolDefinition } from "../../../../../shared/types";
import { logger } from "../../../../../shared/utils/logger";
import { OPERATION_STATUS } from "../../../harness/constants";
import { PLANNING_CONFIG, PLANNING_LOGS, PLANNING_TEMPLATES, SCHEMA_DESC } from "./constants";

type TodoInput = { id: string; description: string; status: string };

function buildChecklist(todos: TodoInput[]): string {
  const lines = ["# Mission Plan", ""];
  for (const todo of todos) {
    const checked = todo.status === "done" ? "x" : " ";
    lines.push(`- [${checked}] ${todo.description}`);
  }
  return `${lines.join("\n")}\n`;
}

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
  execute: async (input: { todos: TodoInput[] }, config?: unknown): Promise<Observation> => {
    try {
      logger.info(PLANNING_LOGS.UPDATING, { count: input.todos.length });
      const stateRoot = process.env.STATE_ROOT ?? "./.echo/state/";
      // Scope the plan file per mission so concurrent missions on one process
      // do not clobber each other's STATE.md.
      const missionId = config && typeof config === "object" ? (config as { missionId?: string }).missionId : undefined;
      const missionDir = missionId ? join(stateRoot, missionId.replace(/[^a-zA-Z0-9._-]/g, "_")) : stateRoot;
      mkdirSync(missionDir, { recursive: true });
      const stateFile = join(missionDir, "STATE.md");
      writeFileSync(stateFile, buildChecklist(input.todos), "utf8");
      return {
        status: OPERATION_STATUS.SUCCESS,
        summary: PLANNING_TEMPLATES.SUMMARY_SUCCESS(input.todos.length),
        data: { todos: input.todos, stateFile },
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
