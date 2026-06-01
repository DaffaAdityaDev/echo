import { z } from 'zod';
import { ToolDefinition, Observation } from '../../types';
import { logger } from '../../../../shared/utils/logger';
import { PATHS } from '../../../../shared/constants';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ARTIFACTS_ROOT = PATHS.ARTIFACTS_ROOT;
const RUNTIME_ROOT = PATHS.STATE_ROOT;

export const read_file: ToolDefinition = {
    name: 'read_file',
    description: 'Read a file\'s contents from the workspace. Supports type "artifact" or "runtime".',
    schema: z.object({
        filename: z.string().describe('Name of the file to read'),
        type: z.enum(['artifact', 'runtime']).default('artifact').describe('The directory type to read from')
    }),
    execute: async (input: { filename: string; type: 'artifact' | 'runtime' }): Promise<Observation> => {
        try {
            const rootDir = input.type === 'artifact' ? ARTIFACTS_ROOT : RUNTIME_ROOT;
            const filePath = join(rootDir, input.filename);
            const content = await readFile(filePath, 'utf-8');

            return {
                status: 'success',
                summary: `Successfully read "${input.filename}":\n\n${content.substring(0, 1000)}${content.length > 1000 ? '\n...[truncated]' : ''}`,
                data: { content }
            };
        } catch (error: any) {
            logger.error(`Failed to read file ${input.filename}`, error);
            return {
                status: 'error',
                summary: `Failed to read file: ${error.message}`,
                error: error.message
            };
        }
    }
};

export default read_file;
