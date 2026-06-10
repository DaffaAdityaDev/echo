import { z } from 'zod';
import { ToolDefinition, Observation } from '../../../../../shared/types';
import { logger } from '../../../../../shared/utils/logger';
import { PATHS } from '../../../../../shared/constants';
import { mkdir, readdir } from 'node:fs/promises';
import { 
    LIST_FILES_CONFIG, 
    LIST_FILES_LOGS, 
    LIST_FILES_FORMATS, 
    WORKSPACE_TYPES, 
    SCHEMA_DESC, 
    OPERATION_STATUS 
} from './constants';

const ARTIFACTS_ROOT = PATHS.ARTIFACTS_ROOT;
const RUNTIME_ROOT = PATHS.STATE_ROOT;

export const list_files: ToolDefinition = {
    name: LIST_FILES_CONFIG.NAME,
    description: LIST_FILES_CONFIG.DESCRIPTION,
    keywords: [...LIST_FILES_CONFIG.KEYWORDS],
    schema: z.object({
        type: z.enum(LIST_FILES_CONFIG.TYPES)
            .default(LIST_FILES_CONFIG.DEFAULT_TYPE)
            .describe(SCHEMA_DESC.TYPE)
    }),
    execute: async (input: { type: typeof WORKSPACE_TYPES[keyof typeof WORKSPACE_TYPES] }): Promise<Observation> => {
        try {
            const rootDir = input.type === WORKSPACE_TYPES.ARTIFACT ? ARTIFACTS_ROOT : RUNTIME_ROOT;
            await mkdir(rootDir, { recursive: true });
            const files = await readdir(rootDir);

            const summary = LIST_FILES_FORMATS.SUMMARY_HEADER(input.type) + 
                            files.map(LIST_FILES_FORMATS.SUMMARY_LINE).join('\n');

            return {
                status: OPERATION_STATUS.SUCCESS,
                summary,
                data: { files }
            };
        } catch (error: any) {
            logger.error(LIST_FILES_LOGS.ERROR, error);
            return {
                status: OPERATION_STATUS.ERROR,
                summary: `${LIST_FILES_LOGS.ERROR}: ${error.message}`,
                error: error.message
            };
        }
    }
};

export default list_files;
