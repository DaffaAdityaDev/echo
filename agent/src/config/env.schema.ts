import { z } from "zod";
import { ENV_DEFAULTS, ENV_VALUES, ENV_VALIDATION_MESSAGES } from "./env.constants";

/**
 * Agent Environment Schema.
 * Note: LLM Provider credentials (API keys) are passed dynamically via provider_config in payloads from Go Backend.
 */
export const envSchema = z.object({
  PORT: z.string().default(ENV_DEFAULTS.PORT),
  GRPC_PORT: z.string().default(ENV_DEFAULTS.GRPC_PORT),
  CHROMA_URL: z.string().default(ENV_DEFAULTS.CHROMA_URL),
  LLM_MODEL_API_URL: z.string().default(ENV_DEFAULTS.LLM_MODEL_API_URL),
  STATE_BACKEND: z.enum(ENV_VALUES.STATE_BACKENDS).default(ENV_VALUES.STATE_BACKENDS[0]),
  NODE_ENV: z.enum(ENV_VALUES.ENVIRONMENTS).default(ENV_VALUES.ENVIRONMENTS[0]),
  DEBUG_PROMPT: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .default(false),
  INTERNAL_AUTH_TOKEN: z.string({
    message: ENV_VALIDATION_MESSAGES.INTERNAL_AUTH_TOKEN
  }),
  LANGFUSE_PUBLIC_KEY: z.string({
    message: ENV_VALIDATION_MESSAGES.LANGFUSE_PUBLIC_KEY
  }),
  LANGFUSE_SECRET_KEY: z.string({
    message: ENV_VALIDATION_MESSAGES.LANGFUSE_SECRET_KEY
  }),
  LANGFUSE_BASE_URL: z.string().default(ENV_DEFAULTS.LANGFUSE_BASE_URL),
  AGENT_RUNTIME_MODE: z.enum(ENV_VALUES.RUNTIME_MODES).default("local"),
  SERVICE_JWT_SECRET: z.string().min(32, ENV_VALIDATION_MESSAGES.SERVICE_JWT_SECRET),
  BACKEND_INTERNAL_URL: z.string().url().default(ENV_DEFAULTS.BACKEND_INTERNAL_URL),
  MCP_SERVER_URL: z.string().url().optional(),
  ENABLE_MCP: z.coerce.boolean().default(false),
  ENABLE_REST_TOOLS: z.coerce.boolean().default(false),
});

export type EnvConfig = z.infer<typeof envSchema>;
