import { KNOWN_DEFAULT_INTERNAL_AUTH_TOKEN, PLACEHOLDER_SECRETS } from "../env.constants";
import { findPlaceholderSecretViolations } from "../env.guards";
import { envSchema } from "../env.schema";

function buildEnv(overrides: Record<string, string>) {
  return envSchema.parse({
    INTERNAL_AUTH_TOKEN: "a-real-unique-internal-token",
    SERVICE_JWT_SECRET: "a-real-unique-service-jwt-secret-of-32+",
    ...overrides,
  });
}

describe("findPlaceholderSecretViolations", () => {
  test("accepts unique secrets in production", () => {
    expect(findPlaceholderSecretViolations(buildEnv({ NODE_ENV: "production" }))).toEqual([]);
  });

  test("rejects the backend default token in every environment", () => {
    const env = buildEnv({ NODE_ENV: "development", INTERNAL_AUTH_TOKEN: KNOWN_DEFAULT_INTERNAL_AUTH_TOKEN });
    expect(findPlaceholderSecretViolations(env)).toHaveLength(1);
  });

  test.each(PLACEHOLDER_SECRETS.INTERNAL_AUTH_TOKEN.map((token) => [token]))(
    "rejects INTERNAL_AUTH_TOKEN placeholder %s in production exactly once",
    (token) => {
      const violations = findPlaceholderSecretViolations(
        buildEnv({ NODE_ENV: "production", INTERNAL_AUTH_TOKEN: token }),
      );
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain("INTERNAL_AUTH_TOKEN");
    },
  );

  test.each(PLACEHOLDER_SECRETS.SERVICE_JWT_SECRET.map((secret) => [secret]))(
    "rejects SERVICE_JWT_SECRET placeholder %s in production",
    (secret) => {
      const violations = findPlaceholderSecretViolations(
        buildEnv({ NODE_ENV: "production", SERVICE_JWT_SECRET: secret }),
      );
      expect(violations).toEqual([expect.stringContaining("SERVICE_JWT_SECRET")]);
    },
  );

  test("allows non-default placeholders outside production", () => {
    const env = buildEnv({ NODE_ENV: "development", INTERNAL_AUTH_TOKEN: "change-me-internal-token" });
    expect(findPlaceholderSecretViolations(env)).toEqual([]);
  });
});
