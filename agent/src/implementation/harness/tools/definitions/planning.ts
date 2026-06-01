import { z } from 'zod';
import { ToolDefinition, Observation } from '../../types';
import { logger } from '../../../../shared/utils/logger';
import { PATHS } from '../../../../shared/constants';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const STATE_ROOT = PATHS.STATE_ROOT;

export const writeTodosTool: ToolDefinition = {
    name: 'write_todos',
    description: 'Create, update, or reorganize the agent\'s task plan (todo list). Use this tool to set or modify the planned execution steps. This will update the persistent STATE.md document.',
    schema: z.object({
        todos: z.array(z.object({
            id: z.string().describe('Unique ID for the task'),
            description: z.string().describe('Detailed description of what needs to be done'),
            status: z.enum(['pending', 'in_progress', 'done', 'failed']).describe('Current status of the task')
        })).describe('The complete list of tasks/todos representing the plan')
    }),
    execute: async (input: { todos: any[] }): Promise<Observation> => {
        try {
            logger.info('Updating agent todos', { count: input.todos.length });

            // Ensure STATE_ROOT exists
            await mkdir(STATE_ROOT, { recursive: true });

            // Format markdown file for STATE.md
            let mdContent = `# Agent Active State & Plan\n\n`;
            mdContent += `Last Updated: ${new Date().toISOString()}\n\n`;
            mdContent += `## Task List\n\n`;
            
            for (const t of input.todos) {
                const marker = t.status === 'done' ? '[x]' : t.status === 'in_progress' ? '[/]' : t.status === 'failed' ? '[!] failed:' : '[ ]';
                mdContent += `- ${marker} **${t.id}**: ${t.description} *(Status: ${t.status})*\n`;
            }

            const stateFilePath = join(STATE_ROOT, 'STATE.md');
            await writeFile(stateFilePath, mdContent, 'utf-8');

            return {
                status: 'success',
                summary: `Successfully updated plan with ${input.todos.length} tasks and saved to STATE.md.`,
                data: {
                    todos: input.todos,
                    stateFile: stateFilePath
                }
            };
        } catch (error: any) {
            logger.error('Failed to write plan/todos', error);
            return {
                status: 'error',
                summary: `Failed to write plan: ${error.message}`,
                error: error.message
            };
        }
    }
};

export default writeTodosTool;
