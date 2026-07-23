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
