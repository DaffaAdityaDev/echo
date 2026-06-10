import { envSchema } from "./env.schema";

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
