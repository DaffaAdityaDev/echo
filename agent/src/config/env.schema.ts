import { z } from "zod";
import { ENV_DEFAULTS, ENV_VALIDATION_MESSAGES, ENV_VALUES } from "./env.constants";

/**
 * Agent Environment Schema.
 * Note: LLM Provider credentials (API keys) are passed dynamically via provider_config in payloads from Go Backend.
 */

// Dev/test convenience secret so local runs work without exporting one.
// Production MUST provide SERVICE_JWT_SECRET explicitly.
const DEV_SERVICE_JWT_SECRET = "change-this-to-a-secure-service-jwt-secret-min32chars";

function isNonProductionEnv(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  return nodeEnv === undefined || nodeEnv === "development" || nodeEnv === "test";
}

export const envSchema = z.object({
  PORT: z.string().default(ENV_DEFAULTS.PORT),
  GRPC_PORT: z.string().default(ENV_DEFAULTS.GRPC_PORT),
  LLM_MODEL_API_URL: z.string().default(ENV_DEFAULTS.LLM_MODEL_API_URL),
  STATE_BACKEND: z.enum(ENV_VALUES.STATE_BACKENDS).default(ENV_VALUES.STATE_BACKENDS[0]),
  NODE_ENV: z.enum(ENV_VALUES.ENVIRONMENTS).default(ENV_VALUES.ENVIRONMENTS[0]),
  DEBUG_PROMPT: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  INTERNAL_AUTH_TOKEN: z.string({
    message: ENV_VALIDATION_MESSAGES.INTERNAL_AUTH_TOKEN,
  }),
  LANGFUSE_PUBLIC_KEY: z.string().default("pk-lf-dummy"),
  LANGFUSE_SECRET_KEY: z.string().default("sk-lf-dummy"),
  LANGFUSE_BASE_URL: z.string().default(ENV_DEFAULTS.LANGFUSE_BASE_URL),
  AGENT_RUNTIME_MODE: z.enum(ENV_VALUES.RUNTIME_MODES).default("local"),
  SERVICE_JWT_SECRET: z.preprocess(
    (val) => (val === undefined && isNonProductionEnv() ? DEV_SERVICE_JWT_SECRET : val),
    z.string({ message: ENV_VALIDATION_MESSAGES.SERVICE_JWT_SECRET }).min(32),
  ),
  BACKEND_URL: z.string().url().default(ENV_DEFAULTS.BACKEND_URL),
  REDIS_URL: z.string().url().default(ENV_DEFAULTS.REDIS_URL),
  MCP_SERVER_URL: z.string().url().optional(),
  ENABLE_MCP: z.coerce.boolean().default(false),
  ENABLE_REST_TOOLS: z.coerce.boolean().default(false),
  ENABLE_TELEMETRY: z.string().default("true"),
});

export type EnvConfig = z.infer<typeof envSchema>;
