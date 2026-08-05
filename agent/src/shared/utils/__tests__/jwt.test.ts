vi.stubEnv("SERVICE_JWT_SECRET", "test-secret");
const jwt = await import("../jwt");

describe("jwt", () => {
  test("signServiceJwt returns a non-empty token", () => {
    const token = jwt.signServiceJwt();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  test("verifyServiceJwt returns the agent subject", () => {
    const payload = jwt.verifyServiceJwt(jwt.signServiceJwt());
    expect(payload.sub).toBe("agent");
  });

  test("exp - iat is about 60 seconds", () => {
    const payload = jwt.verifyServiceJwt(jwt.signServiceJwt());
    const ttl = payload.exp - payload.iat;
    expect(ttl).toBeGreaterThanOrEqual(55);
    expect(ttl).toBeLessThanOrEqual(65);
  });

  test("tampered token fails verification", () => {
    const token = jwt.signServiceJwt();
    const tampered = `${token.slice(0, -2)}xx`;
    expect(() => jwt.verifyServiceJwt(tampered)).toThrow();
  });

  test("sign and verify round-trip works", () => {
    const token = jwt.signServiceJwt();
    const payload = jwt.verifyServiceJwt(token);
    expect(payload).toHaveProperty("sub", "agent");
    expect(payload.iat).toBeTypeOf("number");
    expect(payload.exp).toBeTypeOf("number");
  });

  test("throws synchronously when secret is not configured", async () => {
    vi.resetModules();
    vi.stubEnv("SERVICE_JWT_SECRET", "");
    const fresh = await import("../jwt");
    expect(() => fresh.signServiceJwt()).toThrow();
    expect(() => fresh.verifyServiceJwt("any")).toThrow();
  });
});
