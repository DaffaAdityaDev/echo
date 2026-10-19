import { BOOT_BANNER } from "../shared/constants/banner";
import { findPlaceholderSecretViolations } from "./env.guards";
import { envSchema } from "./env.schema";

console.log(BOOT_BANNER);

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ [CONFIG ERROR] Environment Variables validation failed:");

  for (const issue of parsedEnv.error.issues) {
    console.error(`   👉  ${issue.path.join(".")}: ${issue.message}`);
  }

  process.exit(1);
}

const secretViolations = findPlaceholderSecretViolations(parsedEnv.data);

if (secretViolations.length > 0) {
  for (const violation of secretViolations) {
    console.error(`❌ [CONFIG ERROR] ${violation}`);
  }

  process.exit(1);
}

export const ENV = parsedEnv.data;

export default ENV;
