import { describe, expect, test } from "vitest";
import { createMissionSchema } from "../mission.schema";

describe("createMissionSchema Validation", () => {
  test("successfully parses payload with config containing only featureToggles", () => {
    const rawInput = {
      config: { featureToggles: {} },
      features: ["web_search", "write_todos"],
      message: "test",
      sessionId: "b5948ef6-d000-4a5a-8605-51c48a07e5a2",
      model: "liquid/lfm2.5-1.2b",
      provider_config: {
        api_key: "admin123",
        base_url: "http://10.106.16.214:1234",
        model: "liquid/lfm2.5-1.2b",
        type: "lm-studio",
      },
      user_id: "1",
    };

    const result = createMissionSchema.safeParse(rawInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt).toBe("test");
      expect(result.data.config.harness).toBeDefined();
      expect(result.data.config.harness.maxIterations).toBe(15);
      expect(result.data.config.featureToggles).toEqual({});
    }
  });

  test("successfully parses payload without config object", () => {
    const rawInput = {
      message: "hello",
      provider_config: {
        base_url: "http://localhost:1234",
        model: "gpt-4o",
        type: "openai",
      },
    };

    const result = createMissionSchema.safeParse(rawInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt).toBe("hello");
      expect(result.data.config.harness).toBeDefined();
    }
  });

  test("passes through prompt_template and tenant_id (DB-driven prompt chain)", () => {
    const rawInput = {
      message: "halo",
      prompt_template: "behavior_test",
      tenant_id: "local",
      provider_config: {
        base_url: "http://localhost:1234",
        model: "opencode-go/deepseek-v4-flash",
        type: "opencode-go",
      },
    };

    const result = createMissionSchema.safeParse(rawInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt_template).toBe("behavior_test");
      expect(result.data.tenantId).toBe("local");
    }
  });

  test("prompt_template and tenantId are optional and default gracefully", () => {
    const rawInput = {
      message: "halo",
      provider_config: {
        base_url: "http://localhost:1234",
        model: "gpt-4o",
        type: "openai",
      },
    };

    const result = createMissionSchema.safeParse(rawInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prompt_template).toBeUndefined();
      expect(result.data.tenantId).toBe("local-developer");
    }
  });
});
