import { z } from 'zod';
import { ToolDefinition, Observation } from '../../types';
import { logger } from '../../../../shared/utils/logger';
import { PATHS } from '../../../../shared/constants';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ARTIFACTS_ROOT = PATHS.ARTIFACTS_ROOT;
const RUNTIME_ROOT = PATHS.STATE_ROOT;

export const write_file: ToolDefinition = {
    name: 'write_file',
    description: 'Write text content to a file in the workspace. Use path type "artifact" for user-facing outputs and deliverables, or "runtime" for internal logs/data.',
    schema: z.object({
        filename: z.string().describe('Name of the file (e.g. report.md)'),
        content: z.string().describe('The content to write to the file'),
        type: z.enum(['artifact', 'runtime']).default('artifact').describe('Whether this is a final user-facing deliverable or internal runtime state')
    }),
    execute: async (input: { filename: string; content: string; type: 'artifact' | 'runtime' }): Promise<Observation> => {
        try {
            const rootDir = input.type === 'artifact' ? ARTIFACTS_ROOT : RUNTIME_ROOT;
            await mkdir(rootDir, { recursive: true });
            
            const filePath = join(rootDir, input.filename);
            await writeFile(filePath, input.content, 'utf-8');

            return {
                status: 'success',
                summary: `Successfully wrote file "${input.filename}" to ${input.type} directory.`,
                data: { filePath }
            };
        } catch (error: any) {
            logger.error(`Failed to write file ${input.filename}`, error);
            return {
                status: 'error',
                summary: `Failed to write file: ${error.message}`,
                error: error.message
            };
        }
    }
};

export default write_file;
