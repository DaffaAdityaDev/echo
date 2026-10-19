export const ENV_DEFAULTS = {
  PORT: "3001",
  LLM_MODEL_API_URL: "http://127.0.0.1:1234",
  LANGFUSE_BASE_URL: "http://localhost:3000",
  BACKEND_URL: "http://localhost:8080",
  REDIS_URL: "redis://localhost:6379",
} as const;

export const ENV_VALUES = {
  STATE_BACKENDS: ["memory", "backend"] as const,
  ENVIRONMENTS: ["development", "production", "test"] as const,
  RUNTIME_MODES: ["local", "saas"] as const,
  BOOLEAN_FLAG_TRUE: ["true", "1"] as const,
  BOOLEAN_FLAG_FALSE: ["false", "0"] as const,
} as const;

export const ENV_VALIDATION_MESSAGES = {
  INTERNAL_AUTH_TOKEN: "⚠️ INTERNAL_AUTH_TOKEN is required to secure Agent APIs!",
  LANGFUSE_PUBLIC_KEY: "⚠️ LANGFUSE_PUBLIC_KEY is required for telemetry observability!",
  LANGFUSE_SECRET_KEY: "⚠️ LANGFUSE_SECRET_KEY is required for telemetry observability!",
  SERVICE_JWT_SECRET: "⚠️ SERVICE_JWT_SECRET is required for inter-service JWT authentication!",
} as const;

export const KNOWN_DEFAULT_INTERNAL_AUTH_TOKEN = "default-internal-token-secret" as const;

export const PLACEHOLDER_SECRETS = {
  INTERNAL_AUTH_TOKEN: [
    KNOWN_DEFAULT_INTERNAL_AUTH_TOKEN,
    "change-me-internal-token",
    "change-this-to-a-secure-internal-token",
    "dev-internal-token-8f3a2c9e1b7d4f60",
  ],
  SERVICE_JWT_SECRET: [
    "change-this-to-a-secure-service-jwt-secret-min32chars",
    "dev-service-jwt-secret-min-32-chars!!",
  ],
} as const satisfies Record<string, readonly string[]>;

export const SERVICE_JWT_ALGORITHM = "HS256" as const;
