import { CredentialManager } from "../manager";

describe("CredentialManager", () => {
  let manager: CredentialManager;

  beforeEach(() => {
    manager = new CredentialManager();
  });

  afterEach(() => {
    delete process.env.API_KEY;
    delete process.env.SECRET;
  });

  describe("resolve", () => {
    test("resolves $env.API_KEY to the env value when present", () => {
      process.env.API_KEY = "sk-12345";
      const result = manager.resolve("$env.API_KEY");
      expect(result).toBe("sk-12345");
    });

    test("returns hardcoded string unchanged", () => {
      const result = manager.resolve("hardcoded-string");
      expect(result).toBe("hardcoded-string");
    });

    test("returns empty string for $env.MISSING_VAR by default (non-strict)", () => {
      const result = manager.resolve("$env.MISSING_VAR");
      expect(result).toBe("");
    });

    test("throws when strict mode is set and env var is missing", () => {
      manager.setStrict(true);
      expect(() => manager.resolve("$env.MISSING_VAR")).toThrow("not set");
    });

    test("throws when strict mode is set and env var is empty string", () => {
      process.env.EMPTY_VAR = "";
      manager.setStrict(true);
      expect(() => manager.resolve("$env.EMPTY_VAR")).toThrow("not set");
    });

    test("respects strict option passed per-call", () => {
      process.env.MISSING = "";
      expect(() => manager.resolve("$env.MISSING", { strict: true })).toThrow("not set");
    });

    test("restores previous strict mode after per-call override", () => {
      manager.setStrict(true);
      expect(() => manager.resolve("$env.OK", { strict: false })).not.toThrow();
      expect(() => manager.resolve("$env.MISSING")).toThrow("not set");
    });
  });

  describe("resolve with allowlist", () => {
    test("skips resolution for vars not in allowlist", () => {
      process.env.API_KEY = "sk-12345";
      const result = manager.resolve("$env.API_KEY", { allowlist: ["OTHER"] });
      expect(result).toBe("$env.API_KEY");
    });

    test("resolves vars in allowlist", () => {
      process.env.API_KEY = "sk-12345";
      const result = manager.resolve("$env.API_KEY", { allowlist: ["API_KEY"] });
      expect(result).toBe("sk-12345");
    });
  });

  describe("resolve (deep)", () => {
    test("resolves env refs in nested objects", () => {
      process.env.TOKEN = "t-xyz";
      const input = { auth: { token: "$env.TOKEN", name: "static" } };
      const result = manager.resolve(input);
      expect(result).toEqual({ auth: { token: "t-xyz", name: "static" } });
    });

    test("resolves env refs in arrays", () => {
      process.env.KEY = "val";
      const result = manager.resolve(["$env.KEY", "plain"]);
      expect(result).toEqual(["val", "plain"]);
    });

    test("leaves non-string values unchanged", () => {
      const input = { count: 42, active: true, data: null };
      const result = manager.resolve(input);
      expect(result).toEqual(input);
    });
  });

  describe("registerToolCredentials / validate", () => {
    test("validate returns missing env vars", () => {
      process.env.API_KEY = "sk-12345";
      manager.registerToolCredentials("search", { Authorization: "$env.API_KEY" });
      manager.registerToolCredentials("search", { Token: "$env.MISSING_SECRET" });
      const missing = manager.validate();
      expect(missing).toContain("MISSING_SECRET");
      expect(missing).not.toContain("API_KEY");
    });

    test("validate returns empty when all env vars present", () => {
      process.env.DB_PASS = "pass123";
      manager.registerToolCredentials("db", { password: "$env.DB_PASS" });
      expect(manager.validate()).toEqual([]);
    });
  });

  describe("resolveForRequest", () => {
    test("resolves all env refs in a request object", () => {
      process.env.KEY = "top-secret";
      const result = manager.resolveForRequest({ apiKey: "$env.KEY", static: "hello" });
      expect(result).toEqual({ apiKey: "top-secret", static: "hello" });
    });
  });

  describe("allowlist", () => {
    test("returns true when all required vars are registered", () => {
      manager.registerToolCredentials("search", { key: "$env.API_KEY" });
      expect(manager.allowlist("search", ["API_KEY"])).toBe(true);
    });

    test("returns false when required vars are missing from registration", () => {
      manager.registerToolCredentials("search", { key: "$env.API_KEY" });
      expect(manager.allowlist("search", ["API_KEY", "SECRET"])).toBe(false);
    });
  });

  describe("getMappings", () => {
    test("returns empty array for unknown tool", () => {
      expect(manager.getMappings("unknown")).toEqual([]);
    });

    test("returns credential mappings for registered tool", () => {
      manager.registerToolCredentials("search", { Authorization: "$env.API_KEY" });
      const mappings = manager.getMappings("search");
      expect(mappings).toHaveLength(1);
      expect(mappings[0].envRef).toBe("API_KEY");
    });
  });
});
