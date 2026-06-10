import { z } from 'zod';
import { ToolDefinition, Observation } from '../../../../../shared/types';
import { logger } from '../../../../../shared/utils/logger';
import { PATHS } from '../../../../../shared/constants';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { 
    PLANNING_CONFIG, 
    STATUS_MARKERS, 
    PLANNING_LOGS, 
    PLANNING_TEMPLATES, 
    TASK_STATUS, 
    SCHEMA_DESC, 
    OPERATION_STATUS 
} from './constants';

const STATE_ROOT = PATHS.STATE_ROOT;

export const writeTodosTool: ToolDefinition = {
    name: PLANNING_CONFIG.NAME,
    description: PLANNING_CONFIG.DESCRIPTION,
    keywords: [...PLANNING_CONFIG.KEYWORDS],
    schema: z.object({
        todos: z.array(z.object({
            id: z.string().describe(SCHEMA_DESC.TODO_ID),
            description: z.string().describe(SCHEMA_DESC.TODO_DESC),
            status: z.enum(PLANNING_CONFIG.STATUS_ENUM).describe(SCHEMA_DESC.TODO_STATUS)
        })).describe(SCHEMA_DESC.TODOS)
    }),
    execute: async (input: { todos: any[] }): Promise<Observation> => {
        try {
            logger.info(PLANNING_LOGS.UPDATING, { count: input.todos.length });

            // Ensure STATE_ROOT exists
            await mkdir(STATE_ROOT, { recursive: true });

            // Format markdown file for STATE.md
            let mdContent = PLANNING_TEMPLATES.HEADER;
            mdContent += PLANNING_TEMPLATES.LAST_UPDATED(new Date().toISOString());
            mdContent += PLANNING_TEMPLATES.TASK_LIST_HEADER;
            
            for (const t of input.todos) {
                const marker = t.status === TASK_STATUS.DONE 
                    ? STATUS_MARKERS.DONE 
                    : t.status === TASK_STATUS.IN_PROGRESS 
                    ? STATUS_MARKERS.IN_PROGRESS 
                    : t.status === TASK_STATUS.FAILED 
                    ? STATUS_MARKERS.FAILED 
                    : STATUS_MARKERS.PENDING;
                
                mdContent += PLANNING_TEMPLATES.TASK_LINE(marker, t.id, t.description, t.status);
            }

            const stateFilePath = join(STATE_ROOT, PLANNING_CONFIG.STATE_FILE_NAME);
            await writeFile(stateFilePath, mdContent, PLANNING_CONFIG.FILE_ENCODING);

            return {
                status: OPERATION_STATUS.SUCCESS,
                summary: PLANNING_TEMPLATES.SUMMARY_SUCCESS(input.todos.length),
                data: {
                    todos: input.todos,
                    stateFile: stateFilePath
                }
            };
        } catch (error: any) {
            logger.error(PLANNING_LOGS.FAILED, error);
            return {
                status: OPERATION_STATUS.ERROR,
                summary: `${PLANNING_LOGS.ERROR_PREFIX}: ${error.message}`,
                error: error.message
            };
        }
    }
};

export default writeTodosTool;
