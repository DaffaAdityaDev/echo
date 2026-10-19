import { KNOWN_DEFAULT_INTERNAL_AUTH_TOKEN, PLACEHOLDER_SECRETS } from "./env.constants";
import type { EnvConfig } from "./env.schema";

type PlaceholderCheckedKey = keyof typeof PLACEHOLDER_SECRETS;

function isPlaceholder(key: PlaceholderCheckedKey, value: string): boolean {
  return PLACEHOLDER_SECRETS[key].some((placeholder) => placeholder === value);
}

/**
 * Returns one message per secret that must not be used in the current environment.
 * The backend's well-known default token is rejected everywhere; every other known
 * placeholder (compose defaults, .env.example values) is rejected in production.
 */
export function findPlaceholderSecretViolations(env: EnvConfig): string[] {
  const violations: string[] = [];

  if (env.INTERNAL_AUTH_TOKEN === KNOWN_DEFAULT_INTERNAL_AUTH_TOKEN) {
    violations.push(
      `INTERNAL_AUTH_TOKEN is still set to the known development default "${KNOWN_DEFAULT_INTERNAL_AUTH_TOKEN}" — the backend (ValidateSecrets) refuses to pair with it. Set a strong secret matching the backend before starting the agent.`,
    );
  }

  if (env.NODE_ENV !== "production") return violations;

  const productionChecked: PlaceholderCheckedKey[] = ["INTERNAL_AUTH_TOKEN", "SERVICE_JWT_SECRET"];

  for (const key of productionChecked) {
    if (env[key] !== KNOWN_DEFAULT_INTERNAL_AUTH_TOKEN && isPlaceholder(key, env[key])) {
      violations.push(`${key} is set to a known placeholder value; production requires a unique secret.`);
    }
  }

  return violations;
}
