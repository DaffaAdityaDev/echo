import { z } from 'zod';
import { ToolDefinition, Observation } from '../../../../shared/types';
import { logger } from '../../../../shared/utils/logger';
import { PATHS } from '../../../../shared/constants';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ARTIFACTS_ROOT = PATHS.ARTIFACTS_ROOT;
const RUNTIME_ROOT = PATHS.STATE_ROOT;

export const list_files: ToolDefinition = {
    name: 'list_files',
    description: 'List files in the workspace artifacts or runtime directories.',
    keywords: ["files", "list", "directory", "folders", "workspace", "artifacts"],
    schema: z.object({
        type: z.enum(['artifact', 'runtime']).default('artifact').describe('The directory type to list files from')
    }),
    execute: async (input: { type: 'artifact' | 'runtime' }): Promise<Observation> => {
        try {
            const rootDir = input.type === 'artifact' ? ARTIFACTS_ROOT : RUNTIME_ROOT;
            await mkdir(rootDir, { recursive: true });
            const files = await readdir(rootDir);

            return {
                status: 'success',
                summary: `Files in ${input.type} directory:\n` + files.map(f => `- ${f}`).join('\n'),
                data: { files }
            };
        } catch (error: any) {
            logger.error(`Failed to list files`, error);
            return {
                status: 'error',
                summary: `Failed to list files: ${error.message}`,
                error: error.message
            };
        }
    }
};

export default list_files;
