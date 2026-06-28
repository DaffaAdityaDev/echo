import { join, isAbsolute } from 'node:path';

/**
 * Global API version constants to be used across the Agent Platform.
 */
export const LLM_API_VERSIONS = {
    V1: "/v1",
    V2: "/v2",
    LM_STUDIO_NATIVE: "/v1"
} as const;

export const LLM_CONFIG = {
    DEFAULT_TEMPERATURE: 0.7,
} as const;

export const PATHS = {
    STATE_ROOT: join(process.env.SA_OUTPUT_PATH || process.cwd(), 'runtime'),
    ARTIFACTS_ROOT: join(process.env.SA_OUTPUT_PATH || process.cwd(), 'artifacts'),
} as const;
