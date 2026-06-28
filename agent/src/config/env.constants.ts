export const ENV_DEFAULTS = {
  PORT: "3001",
  GRPC_PORT: "50051",
  CHROMA_URL: "http://localhost:8000",
  LLM_MODEL_API_URL: "http://127.0.0.1:1234",
  LANGFUSE_BASE_URL: "http://localhost:3000",
} as const;

export const ENV_VALUES = {
  STATE_BACKENDS: ["memory"] as const,
  ENVIRONMENTS: ["development", "production", "test"] as const,
  RUNTIME_MODES: ["local", "saas"] as const,
} as const;

export const ENV_VALIDATION_MESSAGES = {
  INTERNAL_AUTH_TOKEN: "⚠️ INTERNAL_AUTH_TOKEN is required to secure Agent APIs!",
  LANGFUSE_PUBLIC_KEY: "⚠️ LANGFUSE_PUBLIC_KEY is required for telemetry observability!",
  LANGFUSE_SECRET_KEY: "⚠️ LANGFUSE_SECRET_KEY is required for telemetry observability!",
} as const;
