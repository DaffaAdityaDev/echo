import { z } from 'zod';
import { ToolDefinition, Observation } from '../../../../../shared/types';
import { logger } from '../../../../../shared/utils/logger';
import { PATHS } from '../../../../../shared/constants';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { 
    WRITE_FILE_CONFIG, 
    WRITE_FILE_LOGS, 
    WRITE_FILE_SUMMARIES, 
    SCHEMA_DESC, 
    OPERATION_STATUS,
    WORKSPACE_TYPES
} from './constants';

const ARTIFACTS_ROOT = PATHS.ARTIFACTS_ROOT;
const RUNTIME_ROOT = PATHS.STATE_ROOT;

export const write_file: ToolDefinition = {
    name: WRITE_FILE_CONFIG.NAME,
    description: WRITE_FILE_CONFIG.DESCRIPTION,
    keywords: [...WRITE_FILE_CONFIG.KEYWORDS],
    schema: z.object({
        filename: z.string().describe(SCHEMA_DESC.FILENAME),
        content: z.string().describe(SCHEMA_DESC.CONTENT),
        type: z.enum(WRITE_FILE_CONFIG.TYPES)
            .default(WRITE_FILE_CONFIG.DEFAULT_TYPE)
            .describe(SCHEMA_DESC.TYPE)
    }),
    execute: async (input: { filename: string; content: string; type: typeof WORKSPACE_TYPES[keyof typeof WORKSPACE_TYPES] }): Promise<Observation> => {
        try {
            const rootDir = input.type === WORKSPACE_TYPES.ARTIFACT ? ARTIFACTS_ROOT : RUNTIME_ROOT;
            await mkdir(rootDir, { recursive: true });
            
            const filePath = join(rootDir, input.filename);
            await writeFile(filePath, input.content, WRITE_FILE_CONFIG.FILE_ENCODING);

            return {
                status: OPERATION_STATUS.SUCCESS,
                summary: WRITE_FILE_SUMMARIES.SUCCESS(input.filename, input.type),
                data: { filePath }
            };
        } catch (error: any) {
            logger.error(WRITE_FILE_LOGS.ERROR(input.filename), error);
            return {
                status: OPERATION_STATUS.ERROR,
                summary: WRITE_FILE_SUMMARIES.GENERIC_ERROR(error.message),
                error: error.message
            };
        }
    }
};

export default write_file;
