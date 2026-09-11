import { BOOT_BANNER } from "../shared/constants/banner";
import { KNOWN_DEFAULT_INTERNAL_AUTH_TOKEN } from "./env.constants";
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

if (parsedEnv.data.INTERNAL_AUTH_TOKEN === KNOWN_DEFAULT_INTERNAL_AUTH_TOKEN) {
  console.error(
    `❌ [CONFIG ERROR] INTERNAL_AUTH_TOKEN is still set to the known development default "${KNOWN_DEFAULT_INTERNAL_AUTH_TOKEN}" — the backend (ValidateSecrets) refuses to pair with it. Set a strong secret matching the backend before starting the agent.`,
  );
  process.exit(1);
}

export const ENV = parsedEnv.data;

export default ENV;
