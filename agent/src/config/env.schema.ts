import { z } from "zod";
import { ENV_DEFAULTS, ENV_VALUES, ENV_VALIDATION_MESSAGES } from "./env.constants";

export const envSchema = z.object({
  PORT: z.string().default(ENV_DEFAULTS.PORT),
  GRPC_PORT: z.string().default(ENV_DEFAULTS.GRPC_PORT),
  CHROMA_URL: z.string().default(ENV_DEFAULTS.CHROMA_URL),
  LLM_MODEL_API_URL: z.string().default(ENV_DEFAULTS.LLM_MODEL_API_URL),
  SA_OUTPUT_PATH: z.string().default(ENV_DEFAULTS.SA_OUTPUT_PATH),
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
  AGENT_RUNTIME_MODE: z.enum(ENV_VALUES.RUNTIME_MODES).default("local")
});

export type EnvConfig = z.infer<typeof envSchema>;
