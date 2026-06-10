import { z } from 'zod';
import { ToolDefinition, Observation } from '../../../../../shared/types';
import { logger } from '../../../../../shared/utils/logger';
import { PATHS } from '../../../../../shared/constants';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { 
    READ_FILE_CONFIG, 
    READ_FILE_ERRORS, 
    READ_FILE_FORMATS, 
    SCHEMA_DESC, 
    OPERATION_STATUS,
    WORKSPACE_TYPES
} from './constants';

const ARTIFACTS_ROOT = PATHS.ARTIFACTS_ROOT;
const RUNTIME_ROOT = PATHS.STATE_ROOT;

export const read_file: ToolDefinition = {
    name: READ_FILE_CONFIG.NAME,
    description: READ_FILE_CONFIG.DESCRIPTION,
    keywords: [...READ_FILE_CONFIG.KEYWORDS],
    schema: z.object({
        filename: z.string().describe(SCHEMA_DESC.FILENAME),
        type: z.enum(READ_FILE_CONFIG.TYPES)
            .default(READ_FILE_CONFIG.DEFAULT_TYPE)
            .describe(SCHEMA_DESC.TYPE)
    }),
    execute: async (input: { filename: string; type: typeof WORKSPACE_TYPES[keyof typeof WORKSPACE_TYPES] }): Promise<Observation> => {
        try {
            const rootDir = input.type === WORKSPACE_TYPES.ARTIFACT ? ARTIFACTS_ROOT : RUNTIME_ROOT;
            const filePath = join(rootDir, input.filename);
            const content = await readFile(filePath, READ_FILE_CONFIG.FILE_ENCODING);

            const isTruncated = content.length > READ_FILE_CONFIG.TRUNCATION_LIMIT;
            const snippet = content.substring(0, READ_FILE_CONFIG.TRUNCATION_LIMIT);
            const summary = READ_FILE_FORMATS.SUMMARY_SUCCESS(input.filename, snippet, isTruncated);

            return {
                status: OPERATION_STATUS.SUCCESS,
                summary,
                data: { content }
            };
        } catch (error: any) {
            logger.error(READ_FILE_ERRORS.LOG_FAILED(input.filename), error);
            
            let summary = READ_FILE_ERRORS.SUMMARY_GENERIC_ERROR(error.message);
            if (error.code === READ_FILE_ERRORS.CODE_NOT_FOUND) {
                summary = READ_FILE_ERRORS.SUMMARY_NOT_FOUND(input.filename, input.type);
            }
            
            return {
                status: OPERATION_STATUS.ERROR,
                summary,
                error: error.message
            };
        }
    }
};

export default read_file;
