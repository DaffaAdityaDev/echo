import { join, isAbsolute } from 'node:path';

/**
 * Global API version constants to be used across the Agent Platform.
 */
export const LLM_API_VERSIONS = {
    V1: "/v1",
    V2: "/v2",
    LM_STUDIO_NATIVE: "/api/v1"
} as const;

export const LLM_CONFIG = {
    DEFAULT_TEMPERATURE: 0.7,
} as const;

// Resolve the root folder for output. If SA_OUTPUT_PATH is set in env, use it.
const rawOutputPath = process.env.SA_OUTPUT_PATH || join(process.cwd(), '..', 'sa-output');
const BASE_OUTPUT = isAbsolute(rawOutputPath) ? rawOutputPath : join(process.cwd(), rawOutputPath);

export const PATHS = {
    STATE_ROOT: join(BASE_OUTPUT, 'runtime'),
    ARTIFACTS_ROOT: join(BASE_OUTPUT, 'artifacts'),
    OFFLOAD_ROOT: join(BASE_OUTPUT, 'runtime', 'files'),
} as const;
