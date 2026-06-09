import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("3001"),
  GRPC_PORT: z.string().default("50051"),
  CHROMA_URL: z.string().default("http://localhost:8000"),
  LLM_MODEL_API_URL: z.string().default("http://127.0.0.1:1234"),
  SA_OUTPUT_PATH: z.string().default("./sa-output"),
  ENABLE_REDIS: z.string().default("false"),
  STATE_BACKEND: z.enum(["memory", "redis"]).default("memory"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DEBUG_PROMPT: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .default(false),
  INTERNAL_AUTH_TOKEN: z.string({
    message: "⚠️ INTERNAL_AUTH_TOKEN is required to secure Agent APIs!"
  })
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ [CONFIG ERROR] Environment Variables validation failed:");
  
  const formattedErrors = parsedEnv.error.format();
  Object.keys(formattedErrors).forEach((key) => {
    if (key !== "_errors") {
      console.error(`   👉  ${key}: ${(formattedErrors as any)[key]?._errors.join(', ')}`);
    }
  });
  
  process.exit(1);
}

export const ENV = parsedEnv.data;
export default ENV;
